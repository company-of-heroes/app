import { ClientResponseError } from 'pocketbase';
import { okAsync } from 'neverthrow';
import { cached } from '../cache';
import { all, fromPb, sequence, type Task } from '../result';
import { Service } from './service';

type ReputationType = { id: string; trigger: string; score: number; enabled: boolean };

/**
 * Reputation is a ledger (`user_reputation`: one row per user, type and source).
 * Totals per type are a view; `users.reputation` is recomputed from the ledger
 * after every change, so it cannot drift.
 */
export class ReputationService extends Service {
	private get ledger() {
		return this.pb.collection('user_reputation');
	}

	private typeFor(trigger: string): Task<ReputationType | undefined> {
		return cached('reputation:types', 60, () =>
			fromPb(
				this.pb
					.collection('reputation_types')
					.getFullList<ReputationType>({ fields: 'id,trigger,score,enabled' }),
				'Could not load reputation types'
			)
		).map((types) => types.find((type) => type.trigger === trigger));
	}

	refreshUserTotal(userId: string): Task<void> {
		return fromPb(
			this.ledger.getFullList<{ amount: number }>({
				filter: this.pb.filter('user = {:userId}', { userId }),
				fields: 'amount',
				batch: 1000
			}),
			'Could not load reputation'
		)
			.andThen((rows) =>
				fromPb(
					this.pb.collection('users').update(userId, {
						reputation: rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
					}),
					'Could not update reputation'
				)
			)
			.map(() => undefined);
	}

	/** Grants `trigger`'s score once per source; disabled or zero-score types grant nothing. */
	award(userId: string, trigger: string, sourceId: string): Task<void> {
		return this.typeFor(trigger).andThen((type) => {
			if (!userId || !sourceId || !type || type.enabled === false || !Number(type.score)) {
				return okAsync(undefined);
			}

			return fromPb(
				this.ledger
					.create({ user: userId, type: type.id, amount: Number(type.score), source: sourceId })
					.then(() => true)
					.catch((error) => {
						// The unique (user, type, source) index makes a repeat award a no-op.
						if (error instanceof ClientResponseError && error.status === 400) {
							return false;
						}

						throw error;
					}),
				'Could not award reputation'
			).andThen((created) => (created ? this.refreshUserTotal(userId) : okAsync(undefined)));
		});
	}

	revoke(userId: string, trigger: string, sourceId: string): Task<void> {
		return this.typeFor(trigger).andThen((type) => {
			if (!userId || !sourceId || !type) {
				return okAsync(undefined);
			}

			return fromPb(
				this.ledger.getFullList<{ id: string }>({
					filter: this.pb.filter('user = {:userId} && type = {:type} && source = {:sourceId}', {
						userId,
						type: type.id,
						sourceId
					}),
					fields: 'id'
				}),
				'Could not load reputation'
			).andThen((rows) =>
				rows.length === 0
					? okAsync(undefined)
					: all(
							rows.map((row) => fromPb(this.ledger.delete(row.id), 'Could not revoke reputation'))
						).andThen(() => this.refreshUserTotal(userId))
			);
		});
	}

	/**
	 * A vote gives the author "<prefix>_received_up/downvote" and the voter
	 * "<prefix>_cast_up/downvote"; value 0 (vote removed) takes both back.
	 * Voting on your own content earns nothing.
	 */
	setVote(input: {
		voterId: string;
		authorId: string;
		sourceId: string;
		value: 1 | -1 | 0;
		prefix: 'replay' | 'comment' | 'player';
	}): Task<void> {
		const { voterId, authorId, sourceId, value, prefix } = input;
		const received = { up: `${prefix}_received_upvote`, down: `${prefix}_received_downvote` };
		const cast = { up: `${prefix}_cast_upvote`, down: `${prefix}_cast_downvote` };
		const revokes = [
			[authorId, received.up],
			[authorId, received.down],
			[voterId, cast.up],
			[voterId, cast.down]
		].filter(([userId]) => userId);
		const awards =
			value === 0 || (voterId && voterId === authorId)
				? []
				: [
						[authorId, value === 1 ? received.up : received.down],
						[voterId, value === 1 ? cast.up : cast.down]
					].filter(([userId]) => userId);
		// Sequential: each step recomputes the user's total from the ledger.
		return sequence(revokes, ([userId, trigger]) => this.revoke(userId, trigger, sourceId))
			.andThen(() => sequence(awards, ([userId, trigger]) => this.award(userId, trigger, sourceId)))
			.map(() => undefined);
	}

	/** Users who already hold `trigger`'s award for this source. */
	awardedFor(trigger: string, sourceId: string): Task<Set<string>> {
		return this.typeFor(trigger).andThen((type) =>
			type
				? fromPb(
						this.ledger.getFullList<{ user: string }>({
							filter: this.pb.filter('type = {:type} && source = {:sourceId}', {
								type: type.id,
								sourceId
							}),
							fields: 'user'
						}),
						'Could not load reputation'
					).map((rows) => new Set(rows.map((row) => row.user)))
				: okAsync(new Set<string>())
		);
	}
}
