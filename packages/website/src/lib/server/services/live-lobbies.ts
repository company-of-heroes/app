import type { RecordModel } from 'pocketbase';
import { err, ok, okAsync } from 'neverthrow';
import { toLiveLobbyRecord, type LiveLobbyRecord } from '@company-of-heroes/ui/live-lobby/slim';
import { cached } from '../cache';
import { notFound } from '../errors';
import { fromPb, pbMaybe, sequence, type Task } from '../result';
import { sameJson } from '../domain/json';
import { publicRecord } from '../domain/public-record';
import {
	LIVE_STALE_MS,
	lobbySteamIds,
	titleFromLive,
	type LivePublish
} from '../domain/lobby-writes';
import type { LobbyRecord, RecordOptions } from './lobbies';
import { Service } from './service';

/** Short shared cache for the public reads: the list changes with every heartbeat. */
export const LIVE_CACHE = 'public, max-age=10, s-maxage=15, stale-while-revalidate=60';

/** Public list size: the home page shows a handful, the live page a grid. */
const LIST_LIMIT = 48;

export type LiveRow = {
	id: string;
	user: string;
	sessionId: number;
	isRanked: boolean;
	map: string;
	players: unknown;
	isReplay: boolean;
	lobby: string;
	matchType: number;
	createdAt: string;
	updatedAt: string;
};

/** PocketBase's date format, for comparing against `updatedAt`. */
const pbDate = (ms: number) => new Date(ms).toISOString().replace('T', ' ');

const isFresh = (row: LiveRow) =>
	!row.isReplay && Date.now() - new Date(row.updatedAt).getTime() < LIVE_STALE_MS;
/** Players with a Steam id, for smurf screening. */
const steamPlayers = (input: LivePublish) =>
	input.players
		.filter((player) => player.steamId ?? player.steam_id)
		.map((player) => {
			const profile = (player.profile ?? {}) as { profile_id?: unknown };
			const profileId = Number(profile.profile_id ?? player.profile_id);
			return {
				steamId: String(player.steamId ?? player.steam_id),
				profileId: Number.isFinite(profileId) && profileId > 0 ? profileId : null
			};
		});
const toPublic = (row: LiveRow, hosts: Map<string, string>) =>
	toLiveLobbyRecord({ ...row, lobbyId: row.lobby || null, hostName: hosts.get(row.user) ?? '' });
/**
 * Live lobbies: one `lobbies_live` row per user while their game runs, refreshed by
 * the app's heartbeat. A live game also gets its durable `lobbies` row right away,
 * so /live/{id} can always link to the match.
 */
export class LiveLobbiesService extends Service {
	private get live() {
		return this.pb.collection('lobbies_live');
	}

	private ownRow(userId: string): Task<LiveRow | undefined> {
		return fromPb(
			this.live.getList<LiveRow>(1, 1, {
				filter: this.pb.filter('user = {:userId}', { userId }),
				skipTotal: true
			}),
			'Could not load live lobby'
		).map((rows) => rows.items[0]);
	}

	/**
	 * The durable lobby for a live game; an in-progress one follows the live player list,
	 * but only when the reporter is one of its players.
	 */
	private durableLobby(userId: string, input: LivePublish): Task<string> {
		const lobbies = this.services.lobbies;
		return lobbies.bySession(input.sessionId).andThen((existing) => {
			if (!existing) {
				return lobbies
					.ensure(userId, {
						sessionId: input.sessionId,
						isRanked: input.isRanked,
						title: titleFromLive(input),
						map: input.map || 'Unknown',
						needsResult: true,
						players: input.players
					})
					.map(({ id }) => id);
			}

			// Someone else's match: no link (a live row pointing at it would hold up its result).
			return lobbies.isParticipant(existing, userId).andThen((participant) => {
				if (!participant) {
					return okAsync('');
				}

				return (existing.needsResult ? this.followLive(existing, input) : okAsync(undefined)).map(
					() => existing.id
				);
			});
		});
	}

	private followLive(existing: LobbyRecord, input: LivePublish): Task<void> {
		const next = {
			map: input.map || existing.map || 'Unknown',
			isRanked: input.isRanked,
			players: input.players,
			...(String(existing.title ?? '').trim() ? {} : { title: titleFromLive(input) })
		};
		const current = {
			map: existing.map,
			isRanked: existing.isRanked,
			players: existing.players,
			...('title' in next ? { title: existing.title } : {})
		};
		if (sameJson(current, next)) {
			return okAsync(undefined);
		}

		return fromPb(this.pb.collection('lobbies').update(existing.id, next), 'Could not update match')
			.andThen(() => this.services.lobbies.process(existing.id))
			.map(() => undefined);
	}

	/** Screens new faces: on the first heartbeat, or when the players change. */
	private screenPlayers(input: LivePublish, previous: LiveRow | undefined): Task<void> {
		const steamIds = lobbySteamIds(input.players);
		const changed = !previous || !sameJson(lobbySteamIds(previous.players), steamIds);
		if (input.isReplay || !changed) {
			return okAsync(undefined);
		}

		return sequence(steamPlayers(input), (player) =>
			this.services.smurf.enqueue({ ...player, source: 'lobby_live' })
		).map(() => undefined);
	}

	/** Every heartbeat proves the players are in-game: ask Steam about borrowed copies. */
	private checkLenders(input: LivePublish): Task<void> {
		if (input.isReplay) {
			return okAsync(undefined);
		}

		return this.services.smurf.checkLiveLenders(steamPlayers(input));
	}

	/** Creates or refreshes the user's live lobby (the app's heartbeat). */
	publish(userId: string, input: LivePublish, options: RecordOptions = {}): Task<RecordModel> {
		const recordOptions = { expand: options.expand, fields: options.fields };
		return this.ownRow(userId).andThen((previous) =>
			(!input.isReplay && input.sessionId > 0
				? this.durableLobby(userId, input)
				: okAsync(input.lobby ?? previous?.lobby ?? '')
			)
				.andThen((lobbyId) => {
					const data = {
						user: userId,
						sessionId: input.sessionId,
						isRanked: input.isRanked,
						map: input.map,
						players: input.players,
						isReplay: input.isReplay,
						lobby: lobbyId,
						...(input.matchType !== undefined ? { matchType: input.matchType } : {})
					};
					return fromPb(
						previous
							? this.live.update(previous.id, data, recordOptions)
							: this.live.create(data, recordOptions),
						'Could not save live lobby'
					);
				})
				.andThen((record) =>
					this.screenPlayers(input, previous)
						.andThen(() => this.checkLenders(input))
						.map(() => publicRecord(record))
				)
		);
	}

	removeRow(row: LiveRow): Task<void> {
		return fromPb(this.live.delete(row.id), 'Could not remove live lobby').andThen(() =>
			row.lobby ? this.services.lobbies.reopenResultFill(row.lobby) : okAsync(undefined)
		);
	}

	/** The game ended: removes the user's live lobby. */
	end(userId: string): Task<void> {
		return this.ownRow(userId).andThen((row) => (row ? this.removeRow(row) : okAsync(undefined)));
	}

	/** A specific live row, for PocketBase-style writes by id (older apps). */
	ownRowById(id: string, userId: string): Task<LiveRow> {
		return pbMaybe(this.live.getOne<LiveRow>(id)).andThen((row) =>
			row && row.user === userId ? ok(row) : err(notFound("The requested resource wasn't found."))
		);
	}

	/** Drops live lobbies whose app stopped sending heartbeats (crash, Alt+F4). */
	cleanup(): Task<{ processed: number; more: boolean }> {
		return fromPb(
			this.live.getList<LiveRow>(1, 100, {
				filter: this.pb.filter('updatedAt < {:threshold}', {
					threshold: pbDate(Date.now() - LIVE_STALE_MS)
				}),
				skipTotal: true
			}),
			'Could not load live lobbies'
		).andThen((stale) =>
			sequence(stale.items, (row) => this.removeRow(row)).map(() => ({
				processed: stale.items.length,
				more: stale.items.length === 100
			}))
		);
	}

	private hostNames(userIds: string[]): Task<Map<string, string>> {
		const ids = [...new Set(userIds.filter(Boolean))];
		if (ids.length === 0) {
			return okAsync(new Map());
		}

		return fromPb(
			this.pb.collection('users').getFullList<{ id: string; name: string }>({
				filter: ids.map((id) => this.pb.filter('id = {:id}', { id })).join(' || '),
				fields: 'id,name'
			}),
			'Could not load hosts'
		).map((users) => new Map(users.map((user) => [user.id, user.name ?? ''])));
	}

	/** Games being played right now (one per Relic session), newest heartbeat first. */
	list(): Task<LiveLobbyRecord[]> {
		return cached('live:list', 10, () =>
			fromPb(
				this.live.getList<LiveRow>(1, LIST_LIMIT, {
					filter: this.pb.filter('updatedAt > {:since} && isReplay != true', {
						since: pbDate(Date.now() - LIVE_STALE_MS)
					}),
					sort: '-updatedAt',
					skipTotal: true
				}),
				'Could not load live lobbies'
			).andThen((rows) =>
				this.hostNames(rows.items.map((row) => row.user)).map((hosts) => {
					const seen = new Set<string>();
					return rows.items.flatMap((row) => {
						const item = toPublic(row, hosts);
						if (!item || seen.has(item.sessionId)) {
							return [];
						}

						seen.add(item.sessionId);
						return [item];
					});
				})
			)
		);
	}

	get(id: string): Task<LiveLobbyRecord> {
		return pbMaybe(this.live.getOne<LiveRow>(id))
			.andThen((row) =>
				row && isFresh(row)
					? this.hostNames([row.user]).map((hosts) => toPublic(row, hosts))
					: okAsync(null)
			)
			.andThen((item) => (item ? ok(item) : err(notFound('Live lobby not found'))));
	}
}
