import { ok, okAsync } from 'neverthrow';
import { RELIC_BASE } from '../clients/relic';
import { ratingUpdates } from '../domain/lobby-derive';
import { eloSlotCount, toEloMap } from '../domain/ratings';
import {
	toHistoryMatches,
	type HistoryMatch,
	type RelicMatchHistory
} from '../domain/relic-matches';
import { chunk, fromPb, sequence, type Task } from '../result';
import { Service } from './service';

const HOUR = 60 * 60 * 1000;
/** A player's ratings are refreshed from Relic at most this often. */
const COOLDOWN_MS = 6 * HOUR;
/** After a failed fetch the player is tried again after about an hour. */
const RETRY_MS = HOUR;
/** Players per scheduled run, plus teammates found in their games. */
const DUE_BATCH = 12;
const TEAMMATE_BATCH = 8;
/** On-demand harvests (leaderboard pages): cap, and skip players refreshed within the hour. */
const ON_DEMAND_MAX = 12;
const ON_DEMAND_SKIP_MS = HOUR;
/** Ranked ladders 4-19; one per 5-minute run, top players only. */
const LADDERS = 16;
const LADDER_TOP = 12;

type Candidate = { id: string; profileId: number; harvestedAt: string; elo: unknown };

const historyUrl = (profileId: number) =>
	`${RELIC_BASE}/community/leaderboard/getrecentmatchhistorybyprofileid?title=coh1&profile_id=${encodeURIComponent(String(profileId))}`;

/** Never harvested first, then the most gaps, then the oldest. */
const byNeed = (a: Candidate | undefined, b: Candidate | undefined) =>
	Number(!!a) - Number(!!b) ||
	Number(!!a?.harvestedAt) - Number(!!b?.harvestedAt) ||
	eloSlotCount(toEloMap(a?.elo)) - eloSlotCount(toEloMap(b?.elo)) ||
	String(a?.harvestedAt ?? '').localeCompare(String(b?.harvestedAt ?? ''));
/**
 * Keeps `player_ratings` fresh from Relic match histories: players whose ratings
 * are oldest (or have the most gaps) first, teammates they met, and the top of
 * each ranked ladder in turn.
 */
export class RatingHarvestService extends Service {
	/** Match histories per profile; null when Relic did not answer. */
	private histories(profileIds: number[]): Task<Map<number, HistoryMatch[] | null>> {
		return this.relic
			.getMany<RelicMatchHistory>(profileIds.map(historyUrl))
			.orElse(() => ok([]))
			.map(
				(results) =>
					new Map(
						profileIds.map((profileId, i) => [
							profileId,
							results[i]?.ok ? toHistoryMatches(results[i].body, profileId) : null
						])
					)
			);
	}

	/** Fetches, stores and stamps; returns the games seen and how many ratings were stored. */
	private refresh(profileIds: number[]): Task<{ matches: HistoryMatch[]; updated: number }> {
		const ratings = this.services.ratings;
		const now = Math.floor(Date.now() / 1000);
		return this.histories(profileIds).andThen((fetched) => {
			const matches = [...fetched.values()].flatMap((list) => list ?? []);
			const answered = profileIds.filter((profileId) => fetched.get(profileId));
			const failed = profileIds.filter((profileId) => !fetched.get(profileId));
			return ratings
				.apply(matches.flatMap((match) => ratingUpdates(match, now)))
				.andThen((stored) =>
					ratings
						.markHarvested(answered, new Date())
						// Due again in about an hour instead of after the full cooldown.
						.andThen(() =>
							ratings.markHarvested(failed, new Date(Date.now() + RETRY_MS - COOLDOWN_MS))
						)
						.map(() => ({ matches, updated: stored.length }))
				);
		});
	}

	private storedByProfile(profileIds: number[]): Task<Map<number, Candidate>> {
		// Chunked: PocketBase rejects filters with a few hundred expressions.
		return sequence(chunk(profileIds, 60), (ids) =>
			fromPb(
				this.pb.collection('player_ratings').getFullList<Candidate>({
					filter: ids
						.map((profileId) => this.pb.filter('profileId = {:profileId}', { profileId }))
						.join(' || '),
					fields: 'id,profileId,harvestedAt,elo'
				}),
				'Could not load ratings'
			)
		).map((pages) => new Map(pages.flat().map((row) => [row.profileId, row])));
	}

	/** Teammates from these games who were not just refreshed, most in need first. */
	private teammatesOf(matches: HistoryMatch[], seen: Set<number>): Task<number[]> {
		const teammates = [
			...new Set(
				matches.flatMap((match) =>
					match.players
						.filter((player) => player.alias?.trim())
						.map((player) => Number(player.profile_id))
				)
			)
		].filter((profileId) => profileId > 0 && !seen.has(profileId));
		return this.storedByProfile(teammates).map((stored) =>
			teammates.sort((a, b) => byNeed(stored.get(a), stored.get(b))).slice(0, TEAMMATE_BATCH)
		);
	}

	/** Scheduled run: the players most in need, then teammates from their games. */
	harvestDue(): Task<{ processed: number; more: boolean }> {
		const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString().replace('T', ' ');
		return fromPb(
			this.pb.collection('player_ratings').getList<Candidate>(1, 64, {
				filter: this.pb.filter("profileId >= 1 && (harvestedAt = '' || harvestedAt <= {:cutoff})", {
					cutoff
				}),
				sort: 'harvestedAt',
				fields: 'id,profileId,harvestedAt,elo',
				skipTotal: true
			}),
			'Could not load ratings'
		).andThen((due) => {
			const players = due.items
				.sort(byNeed)
				.slice(0, DUE_BATCH)
				.map((row) => row.profileId);
			if (players.length === 0) {
				return okAsync({ processed: 0, more: false });
			}

			return this.refresh(players)
				.andThen(({ matches }) => this.teammatesOf(matches, new Set(players)))
				.andThen((picked) =>
					(picked.length > 0 ? this.refresh(picked) : okAsync(null)).map(() => ({
						processed: players.length + picked.length,
						more: false
					}))
				);
		});
	}

	/** On demand (a leaderboard page was opened): skips players refreshed within the hour. */
	harvest(profileIds: number[]): Task<{ processed: number; skipped: number; updated: number }> {
		const unique = [...new Set(profileIds.filter((id) => Number.isInteger(id) && id > 0))];
		return this.storedByProfile(unique.slice(0, 40)).andThen((stored) => {
			const recent = (profileId: number) => {
				const at = Date.parse(stored.get(profileId)?.harvestedAt ?? '');
				return Number.isFinite(at) && Date.now() - at < ON_DEMAND_SKIP_MS;
			};
			const toFetch = unique.filter((profileId) => !recent(profileId)).slice(0, ON_DEMAND_MAX);
			return (toFetch.length > 0 ? this.refresh(toFetch) : okAsync({ updated: 0 })).map(
				({ updated }) => ({
					processed: toFetch.length,
					skipped: unique.length - toFetch.length,
					updated
				})
			);
		});
	}

	/** Scheduled run: the next ranked ladder (by the clock, no stored cursor), top players. */
	harvestLadder(now = new Date()): Task<{ processed: number; more: boolean }> {
		const ladderId = 4 + (Math.floor(now.getTime() / (5 * 60 * 1000)) % LADDERS);
		return this.services.leaderboard
			.get(ladderId)
			.andThen(({ stats }) =>
				this.harvest(
					[...stats]
						.sort((a, b) => a.rank - b.rank)
						.map((stat) => stat.profile.profile_id)
						.filter((profileId) => profileId > 0)
						.slice(0, LADDER_TOP)
				)
			)
			.map(({ processed }) => ({ processed, more: false }));
	}
}
