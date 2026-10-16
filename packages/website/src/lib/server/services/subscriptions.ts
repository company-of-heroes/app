import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type {
	SupporterEntry,
	SupporterStatus,
	SupportersList
} from '@company-of-heroes/ui/supporter/types';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import {
	paddleEnv,
	type PaddleEvent,
	type PaddleSubscription,
	type PaddleTransaction
} from '../clients/paddle';
import { avatarOf } from '../clients/steam';
import { internal, notFound, upstream } from '../errors';
import { steamIdsOf } from '../domain/users';
import { chunk, fromPb, isUniqueCollision, pbMaybe, sequence, type Task } from '../result';
import { Service } from './service';

export type { SupporterEntry, SupporterStatus, SupportersList };

export type SupporterCheckout = {
	priceId: string;
	clientToken: string;
	environment: 'sandbox' | 'production';
	customData: { userId: string };
	email: string | null;
};

/** The generated sign-up address; not a real inbox, so Paddle is not given it. */
const PLACEHOLDER_EMAIL = '@fknoobs.com';

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

/** Lapsed subscriptions re-evaluated per `expire` run. */
const EXPIRE_BATCH = 50;
/**
 * Periods that ended this long ago are still re-evaluated (the job runs hourly); older ones
 * were handled by an earlier run, or `removeLiveExcept` still catches their labels.
 */
const EXPIRE_WINDOW_MS = 90 * 60 * 1000;
/** Steam IDs per `steamIds ~` filter (PocketBase caps expressions per filter). */
const STEAM_CHUNK = 50;

/** PocketBase ids: 15 lowercase letters and digits. */
const USER_ID = /^[a-z0-9]{15}$/;

/** A PocketBase (`2026-10-16 12:00:00.000Z`) or ISO date as ms; 0 when empty. */
function time(value: string | null | undefined): number {
	return value ? Date.parse(value.replace(' ', 'T')) || 0 : 0;
}

/** PocketBase's stored date format, so it compares as a string. */
function pbDate(ms: number): string {
	return new Date(ms).toISOString().replace('T', ' ');
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

	/** What Paddle.js needs to open the checkout for this account. */
	checkout(userId: string): Task<SupporterCheckout> {
		const priceId = publicEnv.PUBLIC_PADDLE_PRICE_ID ?? '';
		const clientToken = publicEnv.PUBLIC_PADDLE_CLIENT_TOKEN ?? '';
		if (!priceId || !clientToken) {
			return errAsync(upstream('Supporter checkout is not configured'));
		}

		return fromPb(
			this.pb.collection('users').getOne<{ email?: string }>(userId, { fields: 'email' }),
			'Could not load account'
		).map((user) => {
			const email = (user.email ?? '').trim();
			return {
				priceId,
				clientToken,
				environment: paddleEnv(privateEnv.PADDLE_ENV),
				customData: { userId },
				email: email && !email.toLowerCase().endsWith(PLACEHOLDER_EMAIL) ? email : null
			};
		});
	}

	/** Paddle customer portal link (cancel, change card); 404 without a subscription. */
	portal(userId: string): Task<{ url: string }> {
		return this.byUser(userId).andThen((row) =>
			row && row.paddleCustomerId
				? this.services.clients.paddle
						.portalUrl(row.paddleCustomerId, row.paddleSubscriptionId)
						.map((url) => ({ url }))
				: errAsync(notFound('No subscription'))
		);
	}

	/** Shows or hides the account on the public supporters page (the medal stays). */
	setHidden(userId: string, hidden: boolean): Task<SupporterStatus> {
		return fromPb(
			this.pb.collection('users').update(userId, { supporterHidden: hidden }),
			'Could not save'
		).andThen(() => this.status(userId));
	}

	/**
	 * The public supporters page: one entry per account (its main Steam ID), hidden accounts
	 * left out. `current` are active subscribers; `former` have paid before and are not active.
	 */
	list(): Task<SupportersList> {
		return ResultAsync.combine([
			fromPb(
				this.payments.getFullList<{ user: string; paidAt: string }>({
					fields: 'user,paidAt',
					sort: 'paidAt'
				}),
				'Could not load payments'
			),
			fromPb(
				this.subscriptions.getFullList<{ user: string }>({
					filter: this.pb.filter(
						"(status = 'active' || status = 'past_due') && currentPeriodEnd > {:now}",
						{ now: pbDate(Date.now()) }
					),
					fields: 'user'
				}),
				'Could not load subscriptions'
			)
		]).andThen(([payments, active]) => {
			const paid = new Map<string, { months: number; since: string }>();
			for (const payment of payments) {
				const stats = paid.get(payment.user);
				if (stats) {
					stats.months += 1;
				} else {
					paid.set(payment.user, { months: 1, since: iso(payment.paidAt) ?? '' });
				}
			}

			const current = new Set(active.map((row) => row.user));
			const userIds = [...new Set([...paid.keys(), ...current])];
			return sequence(chunk(userIds, STEAM_CHUNK), (part) =>
				fromPb(
					this.pb.collection('users').getFullList<{
						id: string;
						steamIds?: unknown;
						supporterHidden?: boolean;
					}>({
						filter: part.map((id) => this.pb.filter('id = {:id}', { id })).join(' || '),
						fields: 'id,steamIds,supporterHidden'
					}),
					'Could not load accounts'
				)
			).andThen((pages) => {
				const accounts = pages
					.flat()
					.filter((user) => !user.supporterHidden)
					.flatMap((user) => {
						const steamId = steamIdsOf(user)[0];
						return steamId ? [{ id: user.id, steamId }] : [];
					});
				const steamIds = accounts.map((account) => account.steamId);
				return ResultAsync.combine([
					this.services.playerInfo.aliases(steamIds),
					this.steam.playerSummaries(steamIds)
				]).map(([aliases, summaries]) => {
					const byMonths = (a: SupporterEntry, b: SupporterEntry) =>
						b.months - a.months || a.since.localeCompare(b.since);
					const entries = accounts.map((account) => {
						const stats = paid.get(account.id);
						const entry: SupporterEntry = {
							steamId: account.steamId,
							alias: aliases.get(account.steamId) || account.steamId,
							avatarUrl: avatarOf(summaries.get(account.steamId)) || null,
							months: stats?.months ?? 0,
							since: stats?.since ?? ''
						};
						return { entry, active: current.has(account.id), paid: Boolean(stats) };
					});
					return {
						current: entries
							.filter((item) => item.active)
							.map((item) => item.entry)
							.sort(byMonths),
						former: entries
							.filter((item) => !item.active && item.paid)
							.map((item) => item.entry)
							.sort(byMonths)
					};
				});
			});
		});
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

	/**
	 * The account an event belongs to. A stored row for the subscription is its owner;
	 * `custom_data.userId` (checkout) is used only for a subscription we have no row for.
	 */
	private resolveUser(
		event: PaddleEvent,
		data: { custom_data?: Record<string, unknown> | null },
		stored: SubscriptionRow | null
	): Task<string | null> {
		if (stored) {
			return okAsync(stored.user);
		}

		const userId = customUserId(data);
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
	 * Upserts the row of a `subscription.*` event. An event not newer than the stored
	 * `paddleUpdatedAt` is skipped (redelivery or out of order); the stored owner is never
	 * changed. A new subscription for an account whose row is still paying never replaces
	 * that row (anyone can check out with someone's id); its payments still count for the
	 * account. A row that is no longer paying is replaced by a newer subscription.
	 */
	private applySubscription(
		event: PaddleEvent,
		data: PaddleSubscription,
		retry: boolean
	): Task<HandleResult> {
		const occurredAt = time(event.occurredAt);
		const values = {
			paddleSubscriptionId: data.id,
			status: mapStatus(data.status),
			paddleUpdatedAt: new Date(occurredAt).toISOString(),
			...(data.customer_id ? { paddleCustomerId: data.customer_id } : {}),
			...(data.current_billing_period
				? { currentPeriodEnd: data.current_billing_period.ends_at }
				: {}),
			canceledAt: data.canceled_at ?? ''
		};
		return this.bySubscriptionId(data.id).andThen((stored) =>
			this.resolveUser(event, data, stored).andThen((userId): Task<HandleResult> => {
				if (!userId) {
					return okAsync({ userId: null });
				}

				if (stored) {
					// Read-then-write: two deliveries at once can race; the next event corrects the row.
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
						if (isActive(other) || occurredAt <= time(other.paddleUpdatedAt)) {
							console.warn(
								'[paddle] kept the current subscription of the account',
								event.type,
								event.id,
								data.id,
								userId
							);
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
							.create({ user: userId, ...values })
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

	/** Steam IDs of active supporters that no other account lists; they keep live labels. */
	private supporterSteamIds(): Task<Set<string>> {
		return fromPb(
			this.subscriptions.getFullList<{ user: string }>({
				filter: this.pb.filter(
					"(status = 'active' || status = 'past_due') && currentPeriodEnd > {:now}",
					{ now: pbDate(Date.now()) }
				),
				fields: 'user'
			}),
			'Could not load subscriptions'
		).andThen((rows) => {
			const users = [...new Set(rows.map((row) => row.user))];
			return sequence(chunk(users, STEAM_CHUNK), (part) =>
				fromPb(
					this.pb.collection('users').getFullList<{ steamIds?: unknown }>({
						filter: part.map((id) => this.pb.filter('id = {:id}', { id })).join(' || '),
						fields: 'steamIds'
					}),
					'Could not load accounts'
				)
			).andThen((pages) => {
				const steamIds = [...new Set(pages.flat().flatMap(steamIdsOf))];
				// Every account listing one of them, supporters included: listed twice means shared.
				return sequence(chunk(steamIds, STEAM_CHUNK), (part) =>
					fromPb(
						this.pb.collection('users').getFullList<{ steamIds?: unknown }>({
							filter: part
								.map((steamId) =>
									this.pb.filter('steamIds ~ {:steamId}', { steamId: `"${steamId}"` })
								)
								.join(' || '),
							fields: 'steamIds'
						}),
						'Could not load accounts'
					)
				).map((listings) => {
					const accounts = new Map<string, number>();
					for (const steamId of listings.flat().flatMap(steamIdsOf)) {
						accounts.set(steamId, (accounts.get(steamId) ?? 0) + 1);
					}

					return new Set(steamIds.filter((steamId) => accounts.get(steamId) === 1));
				});
			});
		});
	}

	/**
	 * Job: re-evaluates accounts whose paid period just ran out without a webhook saying so
	 * (still `active`/`past_due`), at most `EXPIRE_BATCH`, then removes live labels from every
	 * Steam ID that is not an active supporter's (lapsed, unlinked or shared). `more` comes
	 * from the removals only: the lapsed page would list the same accounts again.
	 */
	expire(): Task<{ processed: number; more: boolean }> {
		const now = Date.now();
		return fromPb(
			this.subscriptions.getList<{ user: string }>(1, EXPIRE_BATCH, {
				filter: this.pb.filter(
					"(status = 'active' || status = 'past_due') && currentPeriodEnd != '' && currentPeriodEnd <= {:now} && currentPeriodEnd > {:since}",
					{ now: pbDate(now), since: pbDate(now - EXPIRE_WINDOW_MS) }
				),
				sort: 'currentPeriodEnd',
				fields: 'user',
				skipTotal: true
			}),
			'Could not load subscriptions'
		)
			.andThen((page) =>
				sequence(page.items, (row) =>
					this.services.rewards
						.evaluateNow(row.user)
						.map(() => true)
						.orElse((error) => {
							console.warn('[subscriptions] could not re-evaluate', row.user, error);
							return okAsync(false);
						})
				).map((done) => done.filter(Boolean).length)
			)
			.andThen((evaluated) =>
				this.services.labelAuto
					.removeLiveExcept(() => this.supporterSteamIds())
					.map((removed) => ({
						processed: evaluated + removed.processed,
						more: removed.more
					}))
			);
	}
}
