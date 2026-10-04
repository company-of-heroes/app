import { err, errAsync, ok, okAsync, ResultAsync } from 'neverthrow';
import { cached } from '../cache';
import { RELIC_BASE } from '../clients/relic';
import { avatarOf, type SteamPlayerSummary } from '../clients/steam';
import { badRequest, notFound, upstream } from '../errors';
import { chunk, ensure, fromPb, sequence, type Task } from '../result';
import { isValidSteamId, steamIdFromRelicName, toEloMap, type EloMap } from '../domain/ratings';
import {
	titleHasHiddenKeyword,
	toHistoryMatches,
	type HistoryMatch,
	profileFromPersonalStat,
	type LeaderboardStat,
	type RelicMatchHistory,
	type RelicPersonalStat,
	type RelicProfile
} from '../domain/relic-matches';
import {
	attachMatchHistoryRankLevels,
	ladderStatsFromPersonalStats,
	rankSnapshotsFromLobbies,
	type MatchHistoryLadderStats,
	type MatchRankSnapshots
} from '@company-of-heroes/ui/player/match-history-ranks';
import type { PlayerPerformance } from '../domain/performance';
import type { PlayerLabel } from './player-info';
import { Service } from './service';

const COH_APP_ID = 228200;
/** Relic getpersonalstat accepts at most 10 profile ids per request. */
const PERSONAL_STAT_BATCH = 10;
const PAGE_CACHE_SECONDS = 45;

export type PlayerPage = {
	steamId: string;
	profileId: number;
	alias: string;
	country: string | null;
	level: number;
	avatarUrl: string;
	personastate: number;
	gameextrainfo: string | null;
	lastlogoff: number | null;
	timecreated: number | null;
	playtimeForever: number | null;
	playtime2weeks: number | null;
	leaderboardStats: LeaderboardStat[];
	elo: EloMap;
	performance: PlayerPerformance | null;
	matchHistory: HistoryMatch[];
	smurf: {
		lenderSteamId: string;
		lenderProfileId: null;
		lenderAlias: string;
		lenderAvatarUrl: string | null;
	} | null;
	labels: PlayerLabel[];
	likeCount: number;
};

const personalStatPath = (query: string) =>
	`/community/leaderboard/getpersonalstat?title=coh1&${query}`;

type ReplayLobby = { id: string; sessionId: number; needsResult: boolean; createdAt: string };

export class PlayerPageService extends Service {
	private relicProfile(id: string): Task<RelicProfile | null> {
		if (isValidSteamId(id)) {
			return this.relic
				.get<RelicPersonalStat>(
					personalStatPath(`profile_names=${encodeURIComponent(JSON.stringify([`/steam/${id}`]))}`)
				)
				.map((data) => profileFromPersonalStat(data, (member) => member.name === `/steam/${id}`));
		}

		const profileId = Number(id);
		return this.relic
			.get<RelicPersonalStat>(
				personalStatPath(`profile_ids=${encodeURIComponent(JSON.stringify([profileId]))}`)
			)
			.map((data) =>
				profileFromPersonalStat(data, (member) => Number(member.profile_id) === profileId)
			);
	}

	/**
	 * Current ladder stats for everyone in the match history, 10 profiles per Relic call:
	 * personal ladders plus the arranged-team statgroups those players belong to.
	 */
	private ladderStats(
		profileIds: number[],
		known: Map<number, LeaderboardStat[]>
	): Task<MatchHistoryLadderStats> {
		const ids = [...new Set(profileIds)].filter((id) => id > 0);
		const urls: string[] = [];
		for (let i = 0; i < ids.length; i += PERSONAL_STAT_BATCH) {
			const batch = ids.slice(i, i + PERSONAL_STAT_BATCH);
			urls.push(
				`${RELIC_BASE}${personalStatPath(`profile_ids=${encodeURIComponent(JSON.stringify(batch))}`)}`
			);
		}
		return this.relic.getMany<RelicPersonalStat>(urls).map((results) =>
			ladderStatsFromPersonalStats(
				results.flatMap((result) => (result.ok ? [result.body] : [])),
				known
			)
		);
	}

	/** Community lobbies with a replay for these Relic sessions: finished first, then newest. */
	private replayLobbyIds(sessionIds: number[]): Task<Map<number, string>> {
		const unique = [...new Set(sessionIds.filter((id) => id > 0))];
		return sequence(chunk(unique, 100), (ids) =>
			fromPb(
				this.pb.collection('lobbies').getFullList<ReplayLobby>({
					filter: `hasReplay = true && (${ids
						.map((sessionId) => this.pb.filter('sessionId = {:sessionId}', { sessionId }))
						.join(' || ')})`,
					fields: 'id,sessionId,needsResult,createdAt'
				}),
				'Could not load matches'
			)
		).map((pages) => {
			const preferred = new Map<number, ReplayLobby>();
			for (const lobby of pages.flat()) {
				const current = preferred.get(lobby.sessionId);
				const better =
					!current ||
					(current.needsResult && !lobby.needsResult) ||
					(current.needsResult === lobby.needsResult && lobby.createdAt > current.createdAt);
				if (better) {
					preferred.set(lobby.sessionId, lobby);
				}
			}
			return new Map([...preferred].map(([sessionId, lobby]) => [sessionId, lobby.id]));
		});
	}

	/** Ladder stats the companion captured when these Relic sessions' lobbies started. */
	private rankSnapshots(sessionIds: number[]): Task<MatchRankSnapshots> {
		const unique = [...new Set(sessionIds.filter((id) => id > 0))];
		return sequence(chunk(unique, 100), (ids) =>
			fromPb(
				this.pb.collection('lobbies').getFullList<{ sessionId: number; players?: unknown }>({
					filter: ids
						.map((sessionId) => this.pb.filter('sessionId = {:sessionId}', { sessionId }))
						.join(' || '),
					fields: 'sessionId,players'
				}),
				'Could not load matches'
			)
		).map((pages) => rankSnapshotsFromLobbies(pages.flat()));
	}

	/** An account flagged as someone's smurf shows its (resolved) original account. */
	private smurfOf(steamId: string): Task<PlayerPage['smurf']> {
		return fromPb(
			this.pb.collection('smurf_watch').getList<{ lender_steam_id: string }>(1, 1, {
				filter: this.pb.filter("steam_id = {:steamId} && status = 'resolved'", { steamId }),
				fields: 'lender_steam_id',
				skipTotal: true
			}),
			'Could not load smurf watch'
		).andThen((watch) => {
			const lenderSteamId = watch.items[0]?.lender_steam_id ?? '';
			if (!isValidSteamId(lenderSteamId)) {
				return okAsync(null);
			}

			return this.steam.playerSummaries([lenderSteamId]).map((summaries) => {
				const lender = summaries.get(lenderSteamId);
				return {
					lenderSteamId,
					lenderProfileId: null,
					lenderAlias: lender?.personaname || 'Original account',
					lenderAvatarUrl: avatarOf(lender) || null
				};
			});
		});
	}

	private eloOfProfile(profileId: number): Task<EloMap> {
		return fromPb(
			this.pb.collection('player_ratings').getList<{ elo: unknown }>(1, 1, {
				filter: this.pb.filter('profileId = {:profileId}', { profileId }),
				fields: 'elo',
				skipTotal: true
			}),
			'Could not load ratings'
		).map((rows) => toEloMap(rows.items[0]?.elo));
	}

	/** The profile and its Steam id; not found when either is missing. */
	private profileOf(id: string): Task<{ profile: RelicProfile; steamId: string }> {
		return this.relicProfile(id).andThen((profile) => {
			const steamId = profile
				? steamIdFromRelicName(profile.name) || (isValidSteamId(id) ? id : '')
				: '';
			return profile && isValidSteamId(steamId)
				? ok({ profile, steamId })
				: err(notFound('Player not found'));
		});
	}

	/** Recent matches without hidden ones, with labels, likes, ranks and replay links. */
	private matchHistoryOf(
		profile: RelicProfile,
		steamId: string,
		history: HistoryMatch[],
		hiddenRules: { sessions: Set<number>; keywords: string[] }
	) {
		const { playerInfo } = this.services;
		const matches = history.filter(
			(match) =>
				!hiddenRules.sessions.has(Number(match.id)) &&
				!titleHasHiddenKeyword(match.description, hiddenRules.keywords)
		);
		const steamIds = [
			steamId,
			...matches.flatMap((match) => match.players.map((player) => player.steamId))
		].filter(Boolean);
		const ownStats = new Map([[profile.profile_id, profile.leaderboardStats]]);
		return ResultAsync.combine([
			playerInfo.labels(steamIds),
			playerInfo.likeCounts(steamIds),
			this.ladderStats(
				matches.flatMap((match) => match.players.map((player) => Number(player.profile_id))),
				ownStats
			).orElse(() => ok<MatchHistoryLadderStats>({ personal: ownStats, teams: [] })),
			this.replayLobbyIds(matches.map((match) => Number(match.id))),
			this.rankSnapshots(matches.map((match) => Number(match.id))).orElse(() =>
				ok<MatchRankSnapshots>(new Map())
			)
		]).map(([labels, likes, stats, lobbyIds, snapshots]) => {
			const ranked = attachMatchHistoryRankLevels(matches, stats.personal, stats.teams, snapshots);
			for (const match of ranked) {
				match.lobbyId = lobbyIds.get(Number(match.id)) ?? null;
				for (const player of match.players) {
					player.labels = labels.get(player.steamId) ?? [];
					if (likes.has(player.steamId)) {
						player.likeCount = likes.get(player.steamId);
					}
				}
			}
			return { matches: ranked, labels: labels.get(steamId) ?? [] };
		});
	}

	private load(id: string): Task<Omit<PlayerPage, 'likeCount'>> {
		const { performance, hiddenMatches } = this.services;
		return this.profileOf(id).andThen(({ profile, steamId }) =>
			ResultAsync.combine([
				this.steam.playerSummaries([steamId]),
				this.steam.recentPlaytime(steamId, COH_APP_ID),
				this.relic
					.get<RelicMatchHistory>(
						`/community/leaderboard/getrecentmatchhistorybyprofileid?title=coh1&profile_id=${profile.profile_id}`
					)
					.map((data) => toHistoryMatches(data, profile.profile_id))
					.orElse(() => ok<HistoryMatch[]>([])),
				this.eloOfProfile(profile.profile_id),
				performance.ofProfile(profile.profile_id).orElse(() => ok<PlayerPerformance | null>(null)),
				this.smurfOf(steamId),
				hiddenMatches.rules()
			]).andThen(
				([summaries, playtime, history, elo, communityPerformance, smurf, hiddenRules]) => {
					const summary: SteamPlayerSummary | undefined = summaries.get(steamId);
					if (!summary) {
						return errAsync(notFound('Player not found'));
					}

					return this.matchHistoryOf(profile, steamId, history, hiddenRules).map(
						({ matches, labels }) => ({
							steamId,
							profileId: profile.profile_id,
							alias: profile.alias,
							country: profile.country,
							level: profile.level,
							avatarUrl: avatarOf(summary),
							personastate: summary.personastate ?? 0,
							gameextrainfo: summary.gameextrainfo || null,
							lastlogoff: summary.lastlogoff ?? null,
							timecreated: summary.timecreated ?? null,
							playtimeForever: playtime?.playtime_forever ?? null,
							playtime2weeks: playtime?.playtime_2weeks ?? null,
							leaderboardStats: profile.leaderboardStats,
							elo,
							performance: communityPerformance,
							matchHistory: matches,
							smurf,
							labels
						})
					);
				}
			)
		);
	}

	/**
	 * Everything the player page shows for a Steam id or Relic profile id: Relic profile
	 * and recent matches, Steam presence, stored ELO, community record, labels, likes.
	 */
	get(id: string): Task<PlayerPage> {
		return ensure(
			isValidSteamId(id) || (Number.isInteger(Number(id)) && Number(id) > 0),
			badRequest('id must be a SteamID64 or Relic profile id')
		)
			.andThen(() => ensure(this.steam.configured, upstream('Player service is not configured')))
			.asyncAndThen(() => cached(`player:${id}`, PAGE_CACHE_SECONDS, () => this.load(id)))
			.andThen((page) =>
				// Likes change on click; never serve them from the page cache.
				this.services.playerInfo
					.likeCounts([page.steamId])
					.map((likes) => ({ ...page, likeCount: likes.get(page.steamId) ?? 0 }))
			);
	}
}
