import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { localizeHref } from '@company-of-heroes/i18n';
import type { RibbonManifestEntry } from '@company-of-heroes/ui/reward';
import type {
	PlayerCardData,
	SupporterEntry,
	SupporterStatus,
	SupportersList
} from '@company-of-heroes/ui/supporter/types';
import ribbonManifest from '../../../../../shared-assets/ribbons/ribbons.json';
import { env as privateEnv } from '$env/dynamic/private';
import type { MolliePayment } from '../clients/mollie';
import { avatarOf } from '../clients/steam';
import { cached, uncache } from '../cache';
import { conflict, notFound, upstream } from '../errors';
import { cardFactions, cardRecord, cardRibbons } from '../domain/player-card';
import { isValidSteamId } from '../domain/ratings';
import { steamIdsOf } from '../domain/users';
import { chunk, fromPb, isUniqueCollision, pbMaybe, sequence, type Task } from '../result';
import { Service } from './service';

export type { PlayerCardData, SupporterEntry, SupporterStatus, SupportersList };

/** Where the browser goes to pay the first month, and the payment to look up when it is back. */
export type SupporterCheckout = { checkoutUrl: string; paymentId: string };

/** The first payment as the status page shows it; `unknown` when it is not this account's. */
export type CheckoutState = 'paid' | 'pending' | 'failed' | 'canceled' | 'expired' | 'unknown';

/** The generated sign-up address; not a real inbox, so Mollie is not given it. */
const PLACEHOLDER_EMAIL = '@fknoobs.com';

const PRICE = { currency: 'EUR', value: '4.99' };
const DESCRIPTION = 'coh1stats supporter';
const INTERVAL = '1 month';

/** Paid periods run this long past the next payment date: SEPA direct debit sits in `pending` for days. */
const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

type SubscriptionStatus = 'active' | 'past_due' | 'canceled';

type SubscriptionRow = {
	id: string;
	user: string;
	mollieCustomerId: string;
	mollieSubscriptionId: string;
	mollieMandateId: string;
	status: SubscriptionStatus;
	currentPeriodEnd: string;
	canceledAt: string;
	cancelAt: string;
};

type RowValues = Partial<Omit<SubscriptionRow, 'id' | 'user'>>;

type HandleResult = { userId: string | null };

/** Statuses that keep the medal while the paid period runs (`past_due` after a failed monthly payment). */
const PAYING: readonly string[] = ['active', 'past_due'];

/** PocketBase filter for paying rows; `{:now}` is bound by the caller. */
const PAYING_FILTER = `(${PAYING.map((status) => `status = '${status}'`).join(' || ')}) && currentPeriodEnd > {:now}`;

/** Public supporters page cache key; dropped when a webhook or a hide toggle changes it. */
const LIST_KEY = 'supporters';
const LIST_TTL_SECONDS = 300;

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

/** Mollie payment ids. */
const PAYMENT_ID = /^tr_[A-Za-z0-9]+$/;

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

/** `YYYY-MM-DD` (UTC), as Mollie takes dates. */
function day(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

/** One calendar month later (UTC); the 31st becomes the last day of a shorter month. */
function addMonth(ms: number): number {
	const date = new Date(ms);
	const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 2, 0)).getUTCDate();
	return Date.UTC(
		date.getUTCFullYear(),
		date.getUTCMonth() + 1,
		Math.min(date.getUTCDate(), lastDay),
		date.getUTCHours(),
		date.getUTCMinutes(),
		date.getUTCSeconds(),
		date.getUTCMilliseconds()
	);
}

/** The last paid day: the next payment date, or the end date once cancelled (no grace). */
function paidThrough(row: SubscriptionRow | null): string | null {
	if (!row) {
		return null;
	}

	if (row.cancelAt) {
		return iso(row.cancelAt);
	}

	const end = time(row.currentPeriodEnd);
	return end ? new Date(end - GRACE_MS).toISOString() : null;
}

function isActive(row: SubscriptionRow | null, now = Date.now()): boolean {
	return Boolean(row && PAYING.includes(row.status) && time(row.currentPeriodEnd) > now);
}

function metadataUserId(metadata: Record<string, unknown> | null | undefined): string | null {
	const userId = metadata?.userId;
	return typeof userId === 'string' && USER_ID.test(userId) ? userId : null;
}

/** `4.99` → 499. */
function cents(value: string): number {
	return Math.round(Number(value) * 100);
}

/** Mollie wants a subscription description that is unique per customer. */
function subscriptionDescription(): string {
	return `${DESCRIPTION} ${Date.now().toString(36)}`;
}

/** Undefined when unset: Mollie refuses a webhook it cannot reach (localhost), so dev goes without. */
function webhookUrl(): string | undefined {
	const origin = (privateEnv.MOLLIE_WEBHOOK_ORIGIN ?? '').trim().replace(/\/+$/, '');
	return origin ? `${origin}/api/mollie/webhook` : undefined;
}

/**
 * Mollie supporter subscriptions. A first payment (iDEAL, card, PayPal) creates a mandate;
 * once it is paid the webhook starts a monthly Mollie subscription on it. One `subscriptions`
 * row per account and one `subscription_payments` row per paid payment (its unique id makes
 * a redelivery a no-op). Webhooks carry only a payment id: the payment is read back from
 * Mollie, so order and duplicates do not matter.
 */
export class SubscriptionsService extends Service {
	private get subscriptions() {
		return this.pb.collection('subscriptions');
	}

	private get payments() {
		return this.pb.collection('subscription_payments');
	}

	private get mollie() {
		return this.services.clients.mollie;
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
				this.pb.filter('mollieSubscriptionId = {:subscriptionId}', { subscriptionId })
			),
			'Could not load subscription'
		);
	}

	private byCustomerId(customerId: string): Task<SubscriptionRow | null> {
		return pbMaybe(
			this.subscriptions.getFirstListItem<SubscriptionRow>(
				this.pb.filter('mollieCustomerId = {:customerId}', { customerId })
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
			currentPeriodEnd: paidThrough(row),
			endsAt: iso(row?.cancelAt),
			hidden: Boolean(user?.supporterHidden)
		}));
	}

	/**
	 * A Mollie first payment for this account; the browser is sent to its checkout and comes
	 * back on `origin`'s checkout status page. 409 while it already supports (a cancelled one
	 * resumes).
	 */
	checkout(userId: string, origin: string): Task<SupporterCheckout> {
		if (!this.mollie.configured) {
			return errAsync(upstream('Supporter checkout is not configured'));
		}

		return ResultAsync.combine([
			this.byUser(userId),
			fromPb(
				this.pb.collection('users').getOne<{ email?: string }>(userId, { fields: 'email' }),
				'Could not load account'
			)
		])
			.andThen(([row, user]) =>
				isActive(row)
					? errAsync(conflict(this.locals.t('You are already a supporter.')))
					: this.customerFor(userId, row, user.email ?? '')
			)
			.andThen((customerId) =>
				this.mollie.createPayment({
					amount: PRICE,
					description: DESCRIPTION,
					redirectUrl: `${origin}${localizeHref('/supporters/checkout', this.locals.locale)}`,
					webhookUrl: webhookUrl(),
					sequenceType: 'first',
					customerId,
					metadata: { userId }
				})
			)
			.andThen((payment) => {
				const checkoutUrl = payment._links?.checkout?.href;
				return checkoutUrl
					? okAsync({ checkoutUrl, paymentId: payment.id })
					: errAsync(upstream('Mollie sent no checkout link'));
			});
	}

	/** The account's Mollie customer: the one on its row, else a new one. */
	private customerFor(userId: string, row: SubscriptionRow | null, email: string): Task<string> {
		if (row?.mollieCustomerId) {
			return okAsync(row.mollieCustomerId);
		}

		const address = email.trim();
		const real = address && !address.toLowerCase().endsWith(PLACEHOLDER_EMAIL);
		return this.mollie
			.createCustomer({ ...(real ? { email: address } : {}), metadata: { userId } })
			.map((customer) => customer.id);
	}

	/**
	 * Stops the monthly payments. The medal stays until the paid period ends (`cancelAt`);
	 * a past-due subscription ends now.
	 */
	cancel(userId: string): Task<SupporterStatus> {
		return this.byUser(userId)
			.andThen((row) => {
				if (!row) {
					return errAsync(notFound('No subscription'));
				}

				if (!isActive(row) || row.cancelAt) {
					return errAsync(conflict(this.locals.t('Your subscription is not running.')));
				}

				const now = Date.now();
				const paidThrough = new Date(
					Math.max(now, time(row.currentPeriodEnd) - GRACE_MS)
				).toISOString();
				const stop =
					row.mollieCustomerId && row.mollieSubscriptionId
						? this.mollie.cancelSubscription(row.mollieCustomerId, row.mollieSubscriptionId)
						: okAsync(undefined);
				return stop.andThen(() =>
					fromPb(
						this.subscriptions.update(row.id, {
							cancelAt: paidThrough,
							currentPeriodEnd: paidThrough,
							canceledAt: new Date(now).toISOString()
						}),
						'Could not save subscription'
					)
				);
			})
			.andThen(() => uncache(LIST_KEY))
			.andThen(() => this.status(userId));
	}

	/**
	 * Undoes a cancel before the paid period ends: a new monthly subscription on the same
	 * mandate, charging from `cancelAt`. No payment now. 409 when the mandate is gone.
	 */
	resume(userId: string): Task<SupporterStatus> {
		return this.byUser(userId)
			.andThen((row) => {
				const end = time(row?.cancelAt);
				if (!row || row.status !== 'active' || !isActive(row) || end <= Date.now()) {
					return errAsync(conflict(this.locals.t('There is no cancelled subscription to resume.')));
				}

				const renew = conflict(this.locals.t('Start a new subscription once this one ends.'));
				if (!row.mollieCustomerId || !row.mollieMandateId) {
					return errAsync(renew);
				}

				return this.mollie
					.getMandate(row.mollieCustomerId, row.mollieMandateId)
					.andThen((mandate) =>
						mandate?.status === 'valid'
							? this.mollie.createSubscription(row.mollieCustomerId, {
									amount: PRICE,
									interval: INTERVAL,
									startDate: day(end),
									description: subscriptionDescription(),
									mandateId: row.mollieMandateId,
									webhookUrl: webhookUrl(),
									metadata: { userId }
								})
							: errAsync(renew)
					)
					.andThen((subscription) =>
						fromPb(
							this.subscriptions.update(row.id, {
								mollieSubscriptionId: subscription.id,
								cancelAt: '',
								canceledAt: '',
								currentPeriodEnd: new Date(end + GRACE_MS).toISOString()
							}),
							'Could not save subscription'
						)
					);
			})
			.andThen(() => uncache(LIST_KEY))
			.andThen(() => this.status(userId));
	}

	/** Shows or hides the account on the public supporters page (the medal stays). */
	setHidden(userId: string, hidden: boolean): Task<SupporterStatus> {
		return fromPb(
			this.pb.collection('users').update(userId, { supporterHidden: hidden }),
			'Could not save'
		)
			.andThen(() => uncache(LIST_KEY))
			.andThen(() => this.status(userId));
	}

	/**
	 * The public supporters page: one entry per account (its main Steam ID), hidden accounts
	 * left out. `current` are active subscribers; `former` have paid before and are not active.
	 */
	list(): Task<SupportersList> {
		return cached(LIST_KEY, LIST_TTL_SECONDS, () => this.loadList());
	}

	private loadList(): Task<SupportersList> {
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
					filter: this.pb.filter(PAYING_FILTER, { now: pbDate(Date.now()) }),
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

	/**
	 * The account behind a Steam ID's player card; null unless exactly one account lists it
	 * and that account is an active supporter (a shared Steam ID gets no card, like the medal).
	 */
	cardOwner(steamId: string): Task<string | null> {
		if (!isValidSteamId(steamId)) {
			return okAsync(null);
		}

		return fromPb(
			this.pb.collection('users').getList<{ id: string }>(1, 2, {
				filter: this.pb.filter('steamIds ~ {:steamId}', { steamId: `"${steamId}"` }),
				fields: 'id',
				skipTotal: true
			}),
			'Could not load accounts'
		).andThen((accounts) => {
			const account = accounts.items.length === 1 ? accounts.items[0] : null;
			if (!account) {
				return okAsync(null);
			}

			return this.byUser(account.id).map((row) => (isActive(row) ? account.id : null));
		});
	}

	/** The supporter player card of a Steam ID and its account; null without a card. */
	ownedCard(steamId: string): Task<{ userId: string; card: PlayerCardData } | null> {
		return this.cardOwner(steamId).andThen((userId) => {
			if (!userId) {
				return okAsync(null);
			}

			return ResultAsync.combine([
				this.paymentSummary(userId),
				this.services.playerPage.get(steamId),
				this.services.rewards.forPlayer(steamId, null)
			]).map(([payments, page, rewards]) => {
				const record = cardRecord(page.leaderboardStats);
				const card: PlayerCardData = {
					steamId,
					alias: page.alias,
					avatarUrl: page.avatarUrl || null,
					country: page.country,
					labels: page.labels ?? [],
					factions: cardFactions(page.leaderboardStats, page.elo),
					winRate: record.winRate,
					matches: record.matches,
					ribbons: cardRibbons(rewards.rewards, ribbonManifest as RibbonManifestEntry[]),
					supporterMonths: payments.months,
					supporterSince: payments.since ?? ''
				};
				return { userId, card };
			});
		});
	}

	/** The supporter player card of a Steam ID; null without a card (see `cardOwner`). */
	card(steamId: string): Task<PlayerCardData | null> {
		return this.ownedCard(steamId).map((owned) => owned?.card ?? null);
	}

	isActive(userId: string): Task<boolean> {
		return this.byUser(userId).map((row) => isActive(row));
	}

	months(userId: string): Task<number> {
		return this.paymentSummary(userId).map((summary) => summary.months);
	}

	/**
	 * The state of this account's first payment, for the page the checkout returns to. A paid
	 * one is applied right away (the same idempotent path as the webhook), so the medal does
	 * not wait for a late or missing webhook.
	 */
	checkoutStatus(userId: string, paymentId: string): Task<CheckoutState> {
		if (!PAYMENT_ID.test(paymentId)) {
			return okAsync('unknown');
		}

		return this.mollie.getPayment(paymentId).andThen((payment): Task<CheckoutState> => {
			if (
				!payment ||
				payment.sequenceType !== 'first' ||
				metadataUserId(payment.metadata) !== userId
			) {
				return okAsync('unknown');
			}

			switch (payment.status) {
				case 'paid':
					return this.applyFirst(payment)
						.andThen(() => uncache(LIST_KEY))
						.andThen(() => this.evaluate(userId))
						.map(() => 'paid' as const);
				case 'failed':
				case 'canceled':
				case 'expired':
					return okAsync(payment.status);
				default:
					return okAsync('pending');
			}
		});
	}

	/** Labels and rewards follow a payment at once; if that fails the job picks the user up. */
	evaluate(userId: string): Task<void> {
		return this.services.rewards
			.evaluateNow(userId)
			.map(() => undefined)
			.orElse((error) => {
				console.warn('[mollie] could not evaluate, queued', userId, error);
				return this.services.rewards.markDirty([{ id: userId }]).map(() => undefined);
			});
	}

	/** Applies the payment a webhook names; `userId` is the account to re-evaluate, if any. */
	handleWebhook(paymentId: string): Task<HandleResult> {
		if (!PAYMENT_ID.test(paymentId)) {
			console.warn('[mollie] ignored webhook id', paymentId);
			return okAsync({ userId: null });
		}

		return this.mollie.getPayment(paymentId).andThen((payment) => {
			if (!payment) {
				console.warn('[mollie] unknown payment', paymentId);
				return okAsync({ userId: null });
			}

			const applied =
				payment.sequenceType === 'first'
					? this.applyFirst(payment)
					: payment.subscriptionId
						? this.applyRecurring(payment, payment.subscriptionId)
						: null;
			if (!applied) {
				console.warn('[mollie] ignored payment', payment.id, payment.sequenceType);
				return okAsync({ userId: null });
			}

			return applied.andThen((result) => uncache(LIST_KEY).map(() => result));
		});
	}

	/**
	 * A paid first payment starts the monthly subscription for the account in its metadata
	 * (set by our own checkout, never by the browser). An account that is still paying keeps
	 * its subscription (a redelivery, or a second checkout tab); the payment still counts as
	 * a month.
	 */
	private applyFirst(payment: MolliePayment): Task<HandleResult> {
		if (payment.status !== 'paid') {
			return okAsync({ userId: null });
		}

		const userId = metadataUserId(payment.metadata);
		if (!userId) {
			console.warn('[mollie] no account on payment', payment.id);
			return okAsync({ userId: null });
		}

		return pbMaybe(
			this.pb.collection('users').getOne<{ id: string }>(userId, { fields: 'id' }),
			'Could not load account'
		).andThen((user) => {
			if (!user) {
				console.warn('[mollie] unknown account on payment', payment.id, userId);
				return okAsync({ userId: null });
			}

			return this.byUser(userId)
				.andThen((row) =>
					isActive(row) ? okAsync(undefined) : this.startSubscription(userId, row, payment)
				)
				.andThen(() => this.recordPayment(userId, payment))
				.map(() => ({ userId }));
		});
	}

	/**
	 * Creates the monthly Mollie subscription on the payment's mandate and saves the row.
	 * Without a mandate (a method that cannot charge again) the paid month runs out as if
	 * cancelled.
	 */
	private startSubscription(
		userId: string,
		row: SubscriptionRow | null,
		payment: MolliePayment
	): Task<void> {
		const paidAt = time(payment.paidAt) || time(payment.createdAt) || Date.now();
		const nextPayment = addMonth(paidAt);
		const customerId = payment.customerId ?? '';
		const mandateId = payment.mandateId ?? '';
		if (!customerId || !mandateId) {
			console.warn('[mollie] first payment without a mandate', payment.id);
			const end = new Date(nextPayment).toISOString();
			return this.saveRow(userId, row, {
				mollieCustomerId: customerId,
				mollieSubscriptionId: '',
				mollieMandateId: mandateId,
				status: 'active',
				currentPeriodEnd: end,
				cancelAt: end,
				canceledAt: ''
			}).map(() => undefined);
		}

		return this.mollie
			.createSubscription(customerId, {
				amount: PRICE,
				interval: INTERVAL,
				startDate: day(nextPayment),
				description: subscriptionDescription(),
				mandateId,
				webhookUrl: webhookUrl(),
				metadata: { userId }
			})
			.andThen((subscription) =>
				this.saveRow(userId, row, {
					mollieCustomerId: customerId,
					mollieSubscriptionId: subscription.id,
					mollieMandateId: mandateId,
					status: 'active',
					currentPeriodEnd: new Date(
						(time(subscription.nextPaymentDate) || nextPayment) + GRACE_MS
					).toISOString(),
					cancelAt: '',
					canceledAt: ''
				}).andThen((outcome) => {
					if (outcome === 'saved') {
						return okAsync(undefined);
					}

					// A parallel delivery saved the account's row first: drop this duplicate.
					console.warn('[mollie] duplicate subscription cancelled', subscription.id, userId);
					return this.mollie.cancelSubscription(customerId, subscription.id);
				})
			);
	}

	/** Updates the account's row, or creates it; `collision` when another request created it first. */
	private saveRow(
		userId: string,
		row: SubscriptionRow | null,
		values: RowValues
	): Task<'saved' | 'collision'> {
		if (row) {
			return fromPb(this.subscriptions.update(row.id, values), 'Could not save subscription').map(
				() => 'saved' as const
			);
		}

		return fromPb(
			this.subscriptions
				.create({ user: userId, ...values })
				.then(() => 'saved' as const)
				.catch((error) => {
					if (isUniqueCollision(error)) {
						return 'collision' as const;
					}

					throw error;
				}),
			'Could not save subscription'
		);
	}

	/**
	 * A monthly payment. Paid: counts as a month and moves the period end to the next payment
	 * date. Failed: `past_due`; the medal stays until the period ends and `expire` takes it.
	 * Open or pending (SEPA takes days) changes nothing.
	 */
	private applyRecurring(payment: MolliePayment, subscriptionId: string): Task<HandleResult> {
		return this.bySubscriptionId(subscriptionId)
			.andThen((row) =>
				row || !payment.customerId ? okAsync(row) : this.byCustomerId(payment.customerId)
			)
			.andThen((row): Task<HandleResult> => {
				if (!row) {
					console.warn('[mollie] no account for subscription', subscriptionId, payment.id);
					return okAsync({ userId: null });
				}

				const current = row.mollieSubscriptionId === subscriptionId;
				if (payment.status === 'paid') {
					return this.recordPayment(row.user, payment)
						.andThen(() => this.extend(row, payment, current))
						.map(() => ({ userId: row.user }));
				}

				if (['failed', 'expired', 'canceled'].includes(payment.status) && current) {
					return fromPb(
						this.subscriptions.update(row.id, { status: 'past_due' }),
						'Could not save subscription'
					).map(() => ({ userId: row.user }));
				}

				return okAsync({ userId: null });
			});
	}

	/** Moves the period end after a paid monthly payment; never earlier than it was. */
	private extend(row: SubscriptionRow, payment: MolliePayment, current: boolean): Task<void> {
		const coveredUntil = addMonth(time(payment.createdAt) || Date.now());
		if (row.cancelAt) {
			// Charged while (or just before) it was cancelled: the paid month still runs out.
			const end = new Date(Math.max(time(row.cancelAt), coveredUntil)).toISOString();
			return fromPb(
				this.subscriptions.update(row.id, {
					status: 'active',
					cancelAt: end,
					currentPeriodEnd: end
				}),
				'Could not save subscription'
			).map(() => undefined);
		}

		const subscription =
			current && row.mollieCustomerId
				? this.mollie.getSubscription(row.mollieCustomerId, row.mollieSubscriptionId)
				: okAsync(null);
		return subscription.andThen((found) => {
			const next = time(found?.nextPaymentDate) || coveredUntil;
			const end = Math.max(time(row.currentPeriodEnd), next + GRACE_MS);
			return fromPb(
				this.subscriptions.update(row.id, {
					status: 'active',
					currentPeriodEnd: new Date(end).toISOString()
				}),
				'Could not save subscription'
			).map(() => undefined);
		});
	}

	/** Records a paid payment once; a redelivery hits the unique id and is a no-op. */
	private recordPayment(userId: string, payment: MolliePayment): Task<void> {
		return fromPb(
			this.payments
				.create({
					user: userId,
					molliePaymentId: payment.id,
					amount: cents(payment.amount.value),
					currency: payment.amount.currency,
					paidAt: iso(payment.paidAt) ?? iso(payment.createdAt)
				})
				.then(() => undefined)
				.catch((error) => {
					if (!isUniqueCollision(error)) {
						throw error;
					}

					console.info('[mollie] payment already recorded', payment.id);
				}),
			'Could not save payment'
		);
	}

	/** Steam IDs of active supporters that no other account lists; they keep live labels. */
	private supporterSteamIds(): Task<Set<string>> {
		return fromPb(
			this.subscriptions.getFullList<{ user: string }>({
				filter: this.pb.filter(PAYING_FILTER, { now: pbDate(Date.now()) }),
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
