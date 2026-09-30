import { okAsync } from 'neverthrow';
import { badRequest } from '../errors';
import { normalizeSteamId } from '../domain/member-replays';
import { ensure, fromPb, type Task } from '../result';
import { Service } from './service';
import type { Vote } from './social';

type PlayerVote = { id: string; value: number };

/** Up/down votes on players (by Steam id); the score is the `player_vote_scores` view. */
export class PlayerSocialService extends Service {
	private get likes() {
		return this.pb.collection('player_likes');
	}

	likeCount(steamId: string): Task<number> {
		return fromPb(
			this.pb.collection('player_vote_scores').getList<{ likeCount: number }>(1, 1, {
				filter: this.pb.filter('steamId = {:steamId}', { steamId }),
				fields: 'likeCount',
				skipTotal: true
			}),
			'Could not load player votes'
		).map((rows) => Number(rows.items[0]?.likeCount) || 0);
	}

	/** The account behind a Steam id; voting on one of your own accounts earns nothing. */
	private ownerOf(steamId: string, voterId: string): Task<string> {
		const users = this.pb.collection('users');
		return fromPb(
			users.getOne<{ steamIds: unknown }>(voterId, { fields: 'steamIds' }),
			'User not found'
		).andThen((voter) =>
			Array.isArray(voter.steamIds) && voter.steamIds.map(String).includes(steamId)
				? okAsync(voterId)
				: fromPb(
						users.getList<{ id: string }>(1, 1, {
							filter: this.pb.filter('steamIds ~ {:steamId}', { steamId: `"${steamId}"` }),
							fields: 'id',
							skipTotal: true
						}),
						'Could not load users'
					).map((owners) => owners.items[0]?.id ?? '')
		);
	}

	/** Deletes, updates or creates the user's vote row; returns its id ('' once removed). */
	private store(
		steamId: string,
		userId: string,
		existing: PlayerVote | undefined,
		previous: Vote,
		value: Vote
	): Task<string> {
		if (value === 0) {
			return existing
				? fromPb(this.likes.delete(existing.id), 'Could not remove vote').map(() => existing.id)
				: okAsync('');
		}

		if (existing) {
			return previous === value
				? okAsync(existing.id)
				: fromPb(this.likes.update(existing.id, { value }), 'Could not save vote').map(
						() => existing.id
					);
		}

		return fromPb(
			this.likes.create<{ id: string }>({ steamId, user: userId, value }),
			'Could not save vote'
		).map((created) => created.id);
	}

	/** Sets the user's vote on a player (0 removes it); with `toggle`, the same vote again removes it. */
	vote(
		rawSteamId: string,
		userId: string,
		requested: Vote,
		{ toggle = false } = {}
	): Task<{ vote: Vote; likeCount: number; recordId: string }> {
		const steamId = normalizeSteamId(rawSteamId) ?? '';
		return ensure(steamId, badRequest('steamId is required'))
			.asyncAndThen(() =>
				fromPb(
					this.likes.getList<PlayerVote>(1, 1, {
						filter: this.pb.filter('steamId = {:steamId} && user = {:userId}', { steamId, userId }),
						skipTotal: true
					}),
					'Could not load player votes'
				)
			)
			.andThen((rows) => {
				const existing = rows.items[0];
				const previous: Vote = existing ? (Number(existing.value) === -1 ? -1 : 1) : 0;
				const value: Vote = toggle && requested === previous ? 0 : requested;
				return this.store(steamId, userId, existing, previous, value)
					.andThen((recordId) =>
						recordId && previous !== value
							? this.ownerOf(steamId, userId)
									.andThen((authorId) =>
										this.services.reputation.setVote({
											voterId: userId,
											authorId,
											sourceId: recordId,
											value,
											prefix: 'player'
										})
									)
									.map(() => recordId)
							: okAsync(recordId)
					)
					.andThen((recordId) =>
						this.likeCount(steamId).map((likeCount) => ({ vote: value, likeCount, recordId }))
					);
			});
	}
}
