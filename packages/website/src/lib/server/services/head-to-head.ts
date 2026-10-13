import { okAsync, ResultAsync } from 'neverthrow';
import { cached } from '../cache';
import { anyOfChunks } from '../pb';
import { all, fromPb, sequence, type Task } from '../result';
import {
	emptyHeadToHead,
	ROW_FIELDS,
	summarizeHeadToHead,
	type HeadToHead,
	type HeadToHeadRow
} from '../domain/head-to-head';
import { Service } from './service';

const CACHE_SECONDS = 600;
const TARGET_LIMIT = 16;

type Identity = { key: string; filter: string };

export class HeadToHeadService extends Service {
	/** Fills each game's `createdAt` from its lobby; a lobby that is gone keeps `null`. */
	private withDates(summary: HeadToHead): Task<HeadToHead> {
		const ids = [...new Set(summary.games.map((game) => game.lobbyId))];
		return sequence(anyOfChunks(ids.map((id) => this.pb.filter('id = {:id}', { id }))), (filter) =>
			fromPb(
				this.pb
					.collection('lobbies')
					.getFullList<{ id: string; createdAt: string }>({ filter, fields: 'id,createdAt' }),
				'Could not load head to head'
			)
		).map((pages) => {
			const dates = new Map(pages.flat().map((lobby) => [lobby.id, lobby.createdAt]));
			return {
				...summary,
				games: summary.games.map((game) => ({
					...game,
					createdAt: dates.get(game.lobbyId) ?? null
				}))
			};
		});
	}

	private rowsFor(identity: string): Task<HeadToHeadRow[]> {
		return ResultAsync.combine([
			fromPb(
				this.pb.collection('lobby_player_index').getFullList<HeadToHeadRow>({
					// `counts` = finished and not Skirmish
					filter: `(${identity}) && counts = true && session_id > 0 && (outcome = 0 || outcome = 1)`,
					fields: ROW_FIELDS,
					batch: 1000
				}),
				'Could not load head to head'
			),
			this.services.hiddenMatches.lobbyIds()
		]).map(([rows, hiddenIds]) => rows.filter((row) => !hiddenIds.has(row.lobby)));
	}

	/**
	 * The user's own rows: the `me` profile when it is provably theirs, otherwise all their
	 * linked Steam accounts. `null` when they have neither.
	 */
	private identityFor(userId: string, me: number | null): Task<Identity | null> {
		return fromPb(
			this.pb.collection('users').getOne<{ steamIds: unknown }>(userId, { fields: 'steamIds' }),
			'User not found'
		).andThen((user) => {
			const steamIds = Array.isArray(user.steamIds) ? user.steamIds.map(String) : [];
			const owned = me ? this.services.performance.ownsProfile(me, steamIds) : okAsync(false);
			return owned.map((profileIsMine): Identity | null => {
				if (me && profileIsMine) {
					return { key: `profile:${me}`, filter: this.pb.filter('profile_id = {:me}', { me }) };
				}

				if (steamIds.length === 0) {
					return null;
				}

				return {
					key: `user:${userId}`,
					filter: steamIds
						.map((steamId) => this.pb.filter('steam_id = {:steamId}', { steamId }))
						.join(' || ')
				};
			});
		});
	}

	/** The signed-in user's record against each of `profileIds` (at most 16), keyed by profile id. */
	forUser(
		userId: string,
		me: number | null,
		profileIds: number[]
	): Task<Record<number, HeadToHead>> {
		const targets = [...new Set(profileIds)].filter((id) => id > 0).slice(0, TARGET_LIMIT);
		return this.identityFor(userId, me).andThen((identity) => {
			if (!identity) {
				return okAsync(Object.fromEntries(targets.map((id) => [id, emptyHeadToHead(id)])));
			}

			// My rows load once, and only when a target misses the cache.
			let mine: Task<HeadToHeadRow[]> | undefined;
			const myRows = () => (mine ??= this.rowsFor(identity.filter));
			return all(
				targets.map((id) =>
					cached(`h2h:v2:${identity.key}:${id}`, CACHE_SECONDS, () =>
						all([myRows(), this.rowsFor(this.pb.filter('profile_id = {:id}', { id }))])
							.map(([m, t]) => summarizeHeadToHead(id, m, t))
							.andThen((summary) => this.withDates(summary))
					)
				)
			).map((summaries) =>
				Object.fromEntries(summaries.map((summary) => [summary.profileId, summary]))
			);
		});
	}
}
