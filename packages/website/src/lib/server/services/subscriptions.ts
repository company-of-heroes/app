import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type { SupporterStatus } from '@company-of-heroes/ui/supporter/types';
import type { PaddleEvent, PaddleSubscription, PaddleTransaction } from '../clients/paddle';
import { internal } from '../errors';
import { fromPb, isUniqueCollision, pbMaybe, type Task } from '../result';
import { Service } from './service';

export type { SupporterStatus };

type SubscriptionStatus = 'active' | 'past_due' | 'paused' | 'canceled';

type SubscriptionRow = {
	id: string;
	user: string;
	paddleCustomerId: string;
	paddleSubscriptionId: string;
	status: SubscriptionStatus;
	currentPeriodEnd: string;
	canceledAt: string;
	paddleUpdatedAt: string;
};

type HandleResult = { userId: string | null };

/** Statuses that keep the medal while the paid period runs (`past_due` while Paddle retries a card). */
const PAYING: readonly string[] = ['active', 'past_due'];

/** PocketBase ids: 15 lowercase letters and digits. */
const USER_ID = /^[a-z0-9]{15}$/;

/** A PocketBase (`2026-10-16 12:00:00.000Z`) or ISO date as ms; 0 when empty. */
function time(value: string | null | undefined): number {
	return value ? Date.parse(value.replace(' ', 'T')) || 0 : 0;
}

function iso(value: string | null | undefined): string | null {
	const ms = time(value);
	return ms ? new Date(ms).toISOString() : null;
}

function isActive(row: SubscriptionRow | null, now = Date.now()): boolean {
	return Boolean(row && PAYING.includes(row.status) && time(row.currentPeriodEnd) > now);
}

/** Paddle `trialing` is a running subscription too. */
function mapStatus(status: PaddleSubscription['status']): SubscriptionStatus {
	return status === 'trialing' ? 'active' : status;
}

function customUserId(data: { custom_data?: Record<string, unknown> | null }): string | null {
	const userId = data.custom_data?.userId;
	return typeof userId === 'string' && USER_ID.test(userId) ? userId : null;
}

/**
 * Paddle supporter subscriptions. Only the webhook writes them; one `subscriptions` row per
 * account (by `paddleSubscriptionId`, newest event wins) and one `subscription_payments` row
 * per paid transaction (its unique id makes a redelivery a no-op).
 */
export class SubscriptionsService extends Service {
	private get subscriptions() {
		return this.pb.collection('subscriptions');
	}

	private get payments() {
		return this.pb.collection('subscription_payments');
	}

	private byUser(userId: string): Task<SubscriptionRow | null> {
		return pbMaybe(
			this.subscriptions.getFirstListItem<SubscriptionRow>(
				this.pb.filter('user = {:userId}', { userId })
			),
			'Could not load subscription'
		);
	}

	private bySubscriptionId(subscriptionId: string): Task<SubscriptionRow | null> {
		return pbMaybe(
			this.subscriptions.getFirstListItem<SubscriptionRow>(
				this.pb.filter('paddleSubscriptionId = {:subscriptionId}', { subscriptionId })
			),
			'Could not load subscription'
		);
	}

	/** Paid months and the first payment of an account. */
	private paymentSummary(userId: string): Task<{ months: number; since: string | null }> {
		return fromPb(
			this.payments.getList<{ paidAt: string }>(1, 1, {
				filter: this.pb.filter('user = {:userId}', { userId }),
				sort: 'paidAt',
				fields: 'paidAt'
			}),
			'Could not load payments'
		).map((page) => ({ months: page.totalItems, since: iso(page.items[0]?.paidAt) }));
	}

	/** The account's supporter status; no subscription row means not a supporter. */
	status(userId: string): Task<SupporterStatus> {
		return ResultAsync.combine([
			this.byUser(userId),
			this.paymentSummary(userId),
			pbMaybe(
				this.pb.collection('users').getOne<{ supporterHidden?: boolean }>(userId, {
					fields: 'supporterHidden'
				}),
				'Could not load account'
			)
		]).map(([row, payments, user]) => ({
			active: isActive(row),
			status: row?.status ?? null,
			since: payments.since,
			months: payments.months,
			currentPeriodEnd: iso(row?.currentPeriodEnd),
			hidden: Boolean(user?.supporterHidden)
		}));
	}

	isActive(userId: string): Task<boolean> {
		return this.byUser(userId).map((row) => isActive(row));
	}

	months(userId: string): Task<number> {
		return this.paymentSummary(userId).map((summary) => summary.months);
	}

	/** Applies one verified webhook event; `userId` is the account to re-evaluate, if any. */
	handleWebhook(event: PaddleEvent): Task<HandleResult> {
		if (event.kind === 'subscription') {
			return this.applySubscription(event, event.data, true);
		}

		if (event.kind === 'transaction') {
			return this.applyTransaction(event, event.data);
		}

		console.warn('[paddle] ignored event', event.type, event.id);
		return okAsync({ userId: null });
	}

	/** The account an event belongs to: `custom_data.userId` when it exists, else the stored row's. */
	private resolveUser(
		event: PaddleEvent,
		data: { custom_data?: Record<string, unknown> | null },
		stored: SubscriptionRow | null
	): Task<string | null> {
		const userId = customUserId(data) ?? stored?.user ?? null;
		if (!userId) {
			console.warn('[paddle] no account on event', event.type, event.id);
			return okAsync(null);
		}

		return pbMaybe(
			this.pb.collection('users').getOne<{ id: string }>(userId, { fields: 'id' }),
			'Could not load account'
		).map((user) => {
			if (!user) {
				console.warn('[paddle] unknown account on event', event.type, event.id, userId);
			}

			return user ? user.id : null;
		});
	}

	/**
	 * Upserts the account's row from a `subscription.*` event. An event not newer than the
	 * stored `paddleUpdatedAt` is skipped (redelivery or out of order). The account's row of
	 * another Paddle subscription is replaced only by a newer event that does not turn a
	 * paying row into a non-paying one (a second checkout being cancelled).
	 */
	private applySubscription(
		event: PaddleEvent,
		data: PaddleSubscription,
		retry: boolean
	): Task<HandleResult> {
		const occurredAt = time(event.occurredAt);
		const status = mapStatus(data.status);
		return this.bySubscriptionId(data.id).andThen((stored) =>
			this.resolveUser(event, data, stored).andThen((userId): Task<HandleResult> => {
				if (!userId) {
					return okAsync({ userId: null });
				}

				const values = {
					user: userId,
					paddleSubscriptionId: data.id,
					status,
					paddleUpdatedAt: new Date(occurredAt).toISOString(),
					...(data.customer_id ? { paddleCustomerId: data.customer_id } : {}),
					...(data.current_billing_period
						? { currentPeriodEnd: data.current_billing_period.ends_at }
						: {}),
					canceledAt: data.canceled_at ?? ''
				};
				if (stored) {
					if (occurredAt <= time(stored.paddleUpdatedAt)) {
						console.info('[paddle] skipped stale event', event.type, event.id);
						return okAsync({ userId });
					}

					return fromPb(
						this.subscriptions.update(stored.id, values),
						'Could not save subscription'
					).map(() => ({ userId }));
				}

				return this.byUser(userId).andThen((other): Task<HandleResult> => {
					if (other) {
						const newer = occurredAt > time(other.paddleUpdatedAt);
						const demotes = isActive(other) && !PAYING.includes(status);
						if (!newer || demotes) {
							console.info('[paddle] kept the other subscription of the account', event.id);
							return okAsync({ userId });
						}

						return fromPb(
							this.subscriptions.update(other.id, {
								paddleCustomerId: '',
								currentPeriodEnd: '',
								...values
							}),
							'Could not save subscription'
						).map(() => ({ userId }));
					}

					return fromPb(
						this.subscriptions
							.create(values)
							.then(() => 'created' as const)
							.catch((error) => {
								if (retry && isUniqueCollision(error)) {
									return 'collision' as const;
								}

								throw error;
							}),
						'Could not save subscription'
					).andThen((outcome) =>
						outcome === 'collision'
							? this.applySubscription(event, data, false)
							: okAsync({ userId })
					);
				});
			})
		);
	}

	/** Records a paid subscription transaction once; a redelivery hits the unique id and is a no-op. */
	private applyTransaction(event: PaddleEvent, data: PaddleTransaction): Task<HandleResult> {
		if (!data.subscription_id) {
			console.warn('[paddle] ignored transaction without subscription', event.id, data.id);
			return okAsync({ userId: null });
		}

		const paidAt = iso(data.billed_at) ?? iso(event.occurredAt);
		if (!paidAt) {
			return errAsync(internal('Transaction has no payment date'));
		}

		return this.bySubscriptionId(data.subscription_id).andThen((stored) =>
			this.resolveUser(event, data, stored).andThen((userId): Task<HandleResult> => {
				if (!userId) {
					return okAsync({ userId: null });
				}

				return fromPb(
					this.payments
						.create({
							user: userId,
							paddleTransactionId: data.id,
							amount: Number(data.details.totals.grand_total),
							currency: data.currency_code,
							paidAt
						})
						.then(() => undefined)
						.catch((error) => {
							if (!isUniqueCollision(error)) {
								throw error;
							}

							console.info('[paddle] payment already recorded', data.id);
						}),
					'Could not save payment'
				).map(() => ({ userId }));
			})
		);
	}
}
