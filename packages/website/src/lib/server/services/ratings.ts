import { err, errAsync, ok, okAsync } from 'neverthrow';
import { cached } from '../cache';
import { badRequest, notFound } from '../errors';
import {
	eloHistoryPoints,
	isValidSteamId,
	mergeElo,
	mergeRatingUpdates,
	toEloMap,
	type EloHistoryPoint,
	type EloMap
} from '../domain/ratings';
import { sameJson } from '../domain/json';
import type { RatingUpdate } from '../domain/lobby-derive';
import { all, chunk, ensure, fromPb, sequence, type Task } from '../result';
import { Service } from './service';

/** Games per player the ELO chart looks back over. */
const HISTORY_LIMIT = 500;
/** Ids per `a || b || …` filter. */
const FILTER_CHUNK = 60;

type StoredRating = {
	id: string;
	steamId: string;
	profileId: number;
	alias: string;
	elo: unknown;
	harvestedAt: string;
};

export type PlayerRating = {
	id: string;
	steamId: string;
	profileId: number;
	alias: string;
	elo: EloMap;
	harvestedAt: string | null;
};

const toRating = (row: StoredRating): PlayerRating => ({
	id: row.id,
	steamId: row.steamId,
	profileId: row.profileId,
	alias: row.alias,
	elo: toEloMap(row.elo),
	harvestedAt: row.harvestedAt || null
});

export class RatingsService extends Service {
	/** Stored ratings for a Steam account (filled from lobby results and Relic harvests). */
	get(steamId: string): Task<PlayerRating> {
		return ensure(isValidSteamId(steamId), badRequest('steamId is required'))
			.asyncAndThen(() =>
				fromPb(
					this.pb.collection('player_ratings').getList<StoredRating>(1, 1, {
						filter: this.pb.filter('steamId = {:steamId}', { steamId }),
						skipTotal: true
					}),
					'Could not load ratings'
				)
			)
			.andThen((rows) =>
				rows.items[0] ? ok(toRating(rows.items[0])) : err(notFound('Not found'))
			);
	}

	/** Results of the player's latest games (not Skirmish), newest first. */
	private recentResults(identity: string): Task<object[]> {
		return fromPb(
			this.pb
				.collection('lobby_player_index')
				.getList<{ expand?: { lobby?: { result: unknown } } }>(1, HISTORY_LIMIT, {
					filter: `${identity} && lobby.title != 'Skirmish' && lobby.result != null`,
					sort: '-session_id',
					expand: 'lobby',
					fields: 'expand.lobby.result',
					skipTotal: true
				}),
			'Could not load rating history'
		).map((rows) =>
			rows.items
				.map((row) => row.expand?.lobby?.result)
				.filter((result): result is object => !!result && typeof result === 'object')
		);
	}

	/** Rating after each game, per match type and race, for the ELO chart. */
	history(profileId: number | null, steamId: string | null): Task<{ points: EloHistoryPoint[] }> {
		const validSteam = steamId && isValidSteamId(steamId) ? steamId : null;
		const validProfile =
			profileId && Number.isInteger(profileId) && profileId > 0 ? profileId : null;
		if (!validSteam && !validProfile) {
			return errAsync(badRequest('profileId or steamId is required'));
		}

		const bySteam = () =>
			validSteam
				? this.recentResults(this.pb.filter('steam_id = {:steamId}', { steamId: validSteam }))
				: okAsync<object[]>([]);
		const byProfile = (results: object[]) =>
			results.length === 0 && validProfile
				? this.recentResults(
						this.pb.filter('profile_id = {:profileId}', { profileId: validProfile })
					)
				: okAsync(results);
		return cached(`ratings:history:${validProfile ?? ''}:${validSteam ?? ''}`, 300, () =>
			bySteam()
				.andThen(byProfile)
				.map((results) => ({ points: eloHistoryPoints(results, validProfile, validSteam) }))
		);
	}

	/** Stored rows for the given Steam ids (chunked: PocketBase filters stay short). */
	private rowsFor(steamIds: string[]): Task<StoredRating[]> {
		return sequence(chunk(steamIds, FILTER_CHUNK), (ids) =>
			fromPb(
				this.pb.collection('player_ratings').getFullList<StoredRating>({
					filter: ids
						.map((steamId) => this.pb.filter('steamId = {:steamId}', { steamId }))
						.join(' || ')
				}),
				'Could not load ratings'
			)
		).map((pages) => pages.flat());
	}

	/** Creates or updates one player's row; null when there is no alias to store. */
	private save(update: RatingUpdate, row: StoredRating | undefined): Task<PlayerRating | null> {
		const ratings = this.pb.collection('player_ratings');
		const alias = update.alias || row?.alias?.trim() || '';
		if (!alias) {
			return okAsync(null);
		}

		const elo = mergeElo(toEloMap(row?.elo), update.slots);
		if (
			row &&
			row.alias === alias &&
			row.profileId === update.profileId &&
			sameJson(toEloMap(row.elo), elo)
		) {
			return okAsync(toRating(row));
		}

		return fromPb(
			row
				? ratings.update<StoredRating>(row.id, { profileId: update.profileId, alias, elo })
				: ratings.create<StoredRating>({
						steamId: update.steamId,
						profileId: update.profileId,
						alias,
						elo
					}),
			'Could not save rating'
		).map(toRating);
	}

	/**
	 * Stores observed ratings; a slot only moves forward in time. Players without
	 * any alias (none sent, none stored) are skipped. Returns the stored rows.
	 */
	apply(input: RatingUpdate[]): Task<PlayerRating[]> {
		const updates = mergeRatingUpdates(input).filter(
			(update) => isValidSteamId(update.steamId) && update.profileId > 0 && update.slots.length > 0
		);
		if (updates.length === 0) {
			return okAsync([]);
		}

		return this.rowsFor(updates.map((update) => update.steamId))
			.andThen((rows) => {
				const bySteam = new Map(rows.map((row) => [row.steamId, row]));
				return all(updates.map((update) => this.save(update, bySteam.get(update.steamId))));
			})
			.map((saved) => saved.filter((rating): rating is PlayerRating => rating !== null));
	}

	/**
	 * Players the app saw in a lobby or match history. What the app reports is never
	 * stored: their profiles are refreshed from Relic (on-demand harvest, capped and
	 * skipping recent ones) and the stored ratings come back.
	 */
	ingest(players: Record<string, unknown>[]): Task<PlayerRating[]> {
		const steamIds = [
			...new Set(players.map((player) => String(player.steamId ?? player.steam_id ?? '')))
		].filter(isValidSteamId);
		const profileIds = players
			.map((player) => Number(player.profileId ?? player.profile_id) || 0)
			.filter((profileId) => profileId > 0);
		return this.services.ratingHarvest
			.harvest(profileIds)
			.orElse(() => okAsync(null))
			.andThen(() => (steamIds.length > 0 ? this.rowsFor(steamIds) : okAsync([])))
			.map((rows) => rows.map(toRating));
	}

	/** Marks players as refreshed from Relic (`at` in the past or future moves their next turn). */
	markHarvested(profileIds: number[], at: Date): Task<void> {
		const ratings = this.pb.collection('player_ratings');
		return sequence(chunk(profileIds, FILTER_CHUNK), (ids) =>
			fromPb(
				ratings.getFullList<{ id: string }>({
					filter: ids
						.map((profileId) => this.pb.filter('profileId = {:profileId}', { profileId }))
						.join(' || '),
					fields: 'id'
				}),
				'Could not load ratings'
			).andThen((rows) =>
				all(
					rows.map((row) =>
						fromPb(
							ratings.update(row.id, { harvestedAt: at.toISOString() }),
							'Could not update rating'
						)
					)
				)
			)
		).map(() => undefined);
	}
}
