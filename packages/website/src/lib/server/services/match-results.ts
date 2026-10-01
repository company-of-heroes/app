import { okAsync } from 'neverthrow';
import { RELIC_BASE } from '../clients/relic';
import { MAX_RESULT_ATTEMPTS, resultProfileId } from '../domain/lobby-writes';
import {
	toHistoryMatches,
	type HistoryMatch,
	type RelicMatchHistory
} from '../domain/relic-matches';
import { fromPb, pbMaybe, sequence, type Task } from '../result';
import { Service } from './service';

/** Lobbies per run, and Relic match histories fetched per run. */
const BATCH_SIZE = 40;
const MAX_PROFILES = 5;

type PendingLobby = {
	id: string;
	sessionId: number;
	resultAttempts: number;
	playerProfileIdsCsv: string;
	players: unknown;
	lobbyPlayers: unknown;
};

const historyUrl = (profileId: number) =>
	`${RELIC_BASE}/community/leaderboard/getrecentmatchhistorybyprofileid?title=coh1&profile_id=${encodeURIComponent(String(profileId))}`;

/**
 * Finished games get their result from Relic: a player's recent match history
 * contains the session. Games still being played are skipped (their attempts would
 * run out mid-game); after MAX_RESULT_ATTEMPTS misses a lobby is marked failed.
 */
export class MatchResultsService extends Service {
	private pending(): Task<PendingLobby[]> {
		return fromPb(
			this.pb
				.collection('lobbies_live')
				// Replay viewers only point at a match; they do not hold up its result.
				.getFullList<{ sessionId: number; lobby: string }>({
					filter: 'isReplay != true',
					fields: 'sessionId,lobby'
				}),
			'Could not load live lobbies'
		).andThen((live) => {
			const liveSessions = new Set(live.map((row) => Number(row.sessionId)).filter((id) => id > 0));
			const liveLobbies = new Set(live.map((row) => row.lobby).filter(Boolean));
			return fromPb(
				this.pb.collection('lobbies').getList<PendingLobby>(1, BATCH_SIZE + live.length, {
					filter: this.pb.filter(
						'needsResult = true && hasFailed != true && resultAttempts < {:max}',
						{ max: MAX_RESULT_ATTEMPTS }
					),
					sort: 'resultAttempts,-createdAt',
					fields: 'id,sessionId,resultAttempts,playerProfileIdsCsv,players,lobbyPlayers',
					skipTotal: true
				}),
				'Could not load pending matches'
			).map((rows) =>
				rows.items
					.filter((row) => !liveSessions.has(Number(row.sessionId)) && !liveLobbies.has(row.id))
					.slice(0, BATCH_SIZE)
			);
		});
	}

	private miss(lobby: PendingLobby): Task<void> {
		const attempts = (Number(lobby.resultAttempts) || 0) + 1;
		return fromPb(
			this.pb.collection('lobbies').update(lobby.id, {
				resultAttempts: attempts,
				...(attempts >= MAX_RESULT_ATTEMPTS ? { hasFailed: true } : {})
			}),
			'Could not update match'
		).map(() => undefined);
	}

	/** Stores the result when Relic knew the session, else counts a miss (when `countMiss`). */
	private settle(
		lobby: PendingLobby,
		bySession: Map<number, HistoryMatch>,
		countMiss = true
	): Task<void> {
		const result = bySession.get(Number(lobby.sessionId));
		if (!result) {
			return countMiss ? this.miss(lobby) : okAsync(undefined);
		}

		return fromPb(
			this.pb
				.collection('lobbies')
				.update(lobby.id, { result, needsResult: false, hasFailed: false }),
			'Could not store match result'
		)
			.andThen(() => this.services.lobbies.process(lobby.id))
			.map(() => undefined);
	}

	/**
	 * One lobby, right away (the app saw the game end). A miss is not counted: the
	 * scheduled `fill` keeps trying.
	 */
	fillOne(lobbyId: string): Task<void> {
		return pbMaybe(
			this.pb.collection('lobbies').getFirstListItem<PendingLobby>(
				this.pb.filter('id = {:lobbyId} && needsResult = true && hasFailed != true', { lobbyId }),
				{ fields: 'id,sessionId,resultAttempts,playerProfileIdsCsv,players,lobbyPlayers' }
			),
			'Could not load match'
		).andThen((lobby) => {
			const profileId = lobby ? resultProfileId(lobby) : null;
			if (!lobby || profileId === null) {
				return okAsync(undefined);
			}

			return this.relic.getMany<RelicMatchHistory>([historyUrl(profileId)]).andThen(([history]) => {
				const matches = history?.ok ? toHistoryMatches(history.body, profileId) : [];
				return this.settle(lobby, new Map(matches.map((match) => [Number(match.id), match])), false);
			});
		});
	}

	/** One run: fills what Relic knows, counts a miss for the rest. */
	fill(): Task<{ processed: number; more: boolean }> {
		return this.pending().andThen((lobbiesToFill) => {
			const byProfile = new Map<number, PendingLobby[]>();
			const unknown: PendingLobby[] = [];
			for (const lobby of lobbiesToFill) {
				const profileId = resultProfileId(lobby);
				if (profileId === null) {
					unknown.push(lobby);
				} else {
					byProfile.set(profileId, [...(byProfile.get(profileId) ?? []), lobby]);
				}
			}

			const profileIds = [...byProfile.keys()].slice(0, MAX_PROFILES);
			return sequence(unknown, (lobby) => this.miss(lobby))
				.andThen(() => this.relic.getMany<RelicMatchHistory>(profileIds.map(historyUrl)))
				.andThen((histories) =>
					sequence(profileIds, (profileId, i) => {
						const history = histories[i];
						const matches = history?.ok ? toHistoryMatches(history.body, profileId) : [];
						const bySession = new Map(matches.map((match) => [Number(match.id), match]));
						const lobbies = byProfile.get(profileId) ?? [];
						return sequence(lobbies, (lobby) => this.settle(lobby, bySession)).map(
							() => lobbies.length
						);
					})
				)
				.map((counts) => ({ processed: counts.reduce((sum, n) => sum + n, 0), more: false }));
		});
	}
}
