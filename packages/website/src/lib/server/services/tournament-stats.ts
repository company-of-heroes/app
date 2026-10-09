import { okAsync } from 'neverthrow';
import type {
	HallOfFame,
	HallOfFameEntry,
	HallOfFamePlayer,
	TournamentDetail,
	TournamentMatch,
	TournamentParticipant,
	TournamentStatGame,
	TournamentStats
} from '@company-of-heroes/api/tournaments';
import type { HistoryMatch } from '../domain/relic-matches';
import { badRequest } from '../errors';
import { chunk, ensure, fromPb, inParallel, type Task } from '../result';
import { Service } from './service';

type StatsLobby = {
	id: string;
	map: string;
	result: HistoryMatch | null;
	replayDurationSeconds: number;
	durationSeconds: number;
};

type PodiumRecord = {
	tournament: string;
	placement: number;
	alias: string;
	steamId: string;
	country: string;
};

/** One counted game with its lobby, seen from the match. */
type PlayedGame = {
	match: TournamentMatch;
	lobby: StatsLobby;
	winner: string;
	loser: string;
	durationSeconds: number | null;
};

/** Order of the champion's path: winners bracket, then losers, then the grand final. */
const BRACKET_ORDER: Record<TournamentMatch['bracket'], number> = {
	round_robin: 0,
	winners: 0,
	losers: 1,
	grand_final: 2
};

const FACTIONS = [0, 1, 2, 3];
const MOST_GAMES = 5;
const HALL_OF_FAME_PLAYERS = 50;

/** Numbers of finished tournaments and the hall of fame. Never reveals hidden games. */
export class TournamentStatsService extends Service {
	stats(idOrSlug: string, staff: boolean): Task<TournamentStats> {
		return this.services.tournaments.get(idOrSlug, staff).andThen((detail) =>
			ensure(
				detail.tournament.status === 'completed' || detail.tournament.status === 'cancelled',
				badRequest('Stats are shown once the tournament is over.')
			)
				.asyncAndThen(() =>
					this.lobbies(detail.matches.flatMap((match) => match.games.map((g) => g.lobbyId)))
				)
				.map((lobbies) => compute(detail, lobbies))
		);
	}

	hallOfFame(): Task<HallOfFame> {
		return this.services.tournaments.finished().andThen((finished) => {
			if (finished.length === 0) {
				return okAsync({ tournaments: [], players: [] });
			}

			return this.podiums(finished.map(({ tournament }) => tournament.id)).map((rows) => {
				const byTournament = new Map<string, PodiumRecord[]>();
				for (const row of rows) {
					byTournament.set(row.tournament, [...(byTournament.get(row.tournament) ?? []), row]);
				}

				const tournaments = finished.map(
					({ tournament, finishedAt }): HallOfFameEntry => ({
						tournament: {
							id: tournament.id,
							name: tournament.name,
							slug: tournament.slug,
							format: tournament.format,
							logoUrl: tournament.logoUrl,
							medal: tournament.medal,
							participantCount: tournament.participantCount,
							startsAt: tournament.startsAt
						},
						finishedAt,
						podium: (byTournament.get(tournament.id) ?? [])
							.sort((a, b) => a.placement - b.placement)
							.map((row) => ({
								placement: row.placement,
								alias: row.alias,
								steamId: row.steamId,
								country: row.country ?? ''
							}))
					})
				);
				const players = new Map<string, HallOfFamePlayer>();
				for (const entry of tournaments) {
					for (const row of entry.podium) {
						const player = players.get(row.steamId) ?? {
							steamId: row.steamId,
							alias: row.alias,
							country: row.country,
							titles: 0,
							podiums: 0
						};
						player.podiums++;
						if (row.placement === 1) {
							player.titles++;
						}

						players.set(row.steamId, player);
					}
				}

				return {
					tournaments,
					players: [...players.values()]
						.sort((a, b) => b.titles - a.titles || b.podiums - a.podiums)
						.slice(0, HALL_OF_FAME_PLAYERS)
				};
			});
		});
	}

	/** Participants that finished first, second or third in these tournaments. */
	private podiums(tournamentIds: string[]): Task<PodiumRecord[]> {
		return inParallel(chunk(tournamentIds, 50), 3, (slice) =>
			fromPb(
				this.pb.collection('tournament_participants').getFullList<PodiumRecord>({
					filter: `placement >= 1 && placement <= 3 && status != "withdrawn" && (${slice
						.map((id) => this.pb.filter('tournament = {:id}', { id }))
						.join(' || ')})`,
					fields: 'tournament,placement,alias,steamId,country'
				}),
				'Could not load the hall of fame'
			)
		).map((pages) => pages.flat());
	}

	/** The lobbies of the counted games (only called once the tournament is over). */
	private lobbies(ids: string[]): Task<Map<string, StatsLobby>> {
		const unique = [...new Set(ids)];
		if (unique.length === 0) {
			return okAsync(new Map());
		}

		return inParallel(chunk(unique, 50), 3, (slice) =>
			fromPb(
				this.pb.collection('lobbies').getFullList<StatsLobby>({
					filter: slice.map((id) => this.pb.filter('id = {:id}', { id })).join(' || '),
					fields: 'id,map,result,replayDurationSeconds,durationSeconds'
				}),
				'Could not load the games'
			)
		).map((pages) => new Map(pages.flat().map((lobby) => [lobby.id, lobby])));
	}
}

const mapOf = (lobby: StatsLobby) => lobby.map || lobby.result?.mapname || '';

function statGame(game: PlayedGame): TournamentStatGame {
	return {
		lobbyId: game.lobby.id,
		matchId: game.match.id,
		map: mapOf(game.lobby),
		durationSeconds: game.durationSeconds,
		winner: game.winner,
		loser: game.loser
	};
}

function compute(detail: TournamentDetail, lobbies: Map<string, StatsLobby>): TournamentStats {
	const participants = new Map(detail.participants.map((p) => [p.id, p]));
	const played = detail.matches.filter((match) => !match.bye);
	const games = played.flatMap((match) =>
		match.games.flatMap((game): PlayedGame[] => {
			const lobby = lobbies.get(game.lobbyId);
			const winner = game.winner === 'A' ? match.playerA : match.playerB;
			const loser = game.winner === 'A' ? match.playerB : match.playerA;
			if (!lobby || !winner || !loser) {
				return [];
			}

			return [
				{
					match,
					lobby,
					winner,
					loser,
					durationSeconds: lobby.durationSeconds || lobby.replayDurationSeconds || null
				}
			];
		})
	);

	const factions = new Map(FACTIONS.map((raceId) => [raceId, { raceId, picks: 0, wins: 0 }]));
	const maps = new Map<string, number>();
	const gamesPlayed = new Map<string, number>();
	for (const game of games) {
		for (const id of [game.winner, game.loser]) {
			gamesPlayed.set(id, (gamesPlayed.get(id) ?? 0) + 1);
			const profileId = participants.get(id)?.profileId;
			const player = game.lobby.result?.players?.find((p) => p.profile_id === profileId);
			const faction = player ? factions.get(player.race_id) : undefined;
			if (!faction) {
				continue;
			}

			faction.picks++;
			if ((player?.outcome ?? (id === game.winner ? 1 : 0)) === 1) {
				faction.wins++;
			}
		}

		const map = mapOf(game.lobby);
		if (map) {
			maps.set(map, (maps.get(map) ?? 0) + 1);
		}
	}

	const timed = games.filter((game) => game.durationSeconds !== null);
	const byLength = [...timed].sort((a, b) => b.durationSeconds! - a.durationSeconds!);
	const completed = played.filter((match) => match.status === 'completed');

	return {
		games: games.length,
		matches: completed.length,
		walkovers: completed.filter((match) => match.games.length === 0).length,
		totalSeconds: timed.reduce((sum, game) => sum + game.durationSeconds!, 0),
		factions: [...factions.values()].filter((faction) => faction.picks > 0),
		maps: [...maps.entries()]
			.map(([map, count]) => ({ map, games: count }))
			.sort((a, b) => b.games - a.games || a.map.localeCompare(b.map)),
		longest: byLength.length > 0 ? statGame(byLength[0]) : null,
		shortest: byLength.length > 1 ? statGame(byLength[byLength.length - 1]) : null,
		upset: upsetOf(completed, games, participants),
		mostGames: [...gamesPlayed.entries()]
			.map(([participant, count]) => ({ participant, games: count }))
			.sort((a, b) => b.games - a.games)
			.slice(0, MOST_GAMES),
		championPath: championPath(detail)
	};
}

/** The completed match whose winner had the highest seed number over the loser (biggest gap). */
function upsetOf(
	completed: TournamentMatch[],
	games: PlayedGame[],
	participants: Map<string, TournamentParticipant>
): TournamentStats['upset'] {
	let best: TournamentStats['upset'] = null;
	for (const match of completed) {
		const loserId = match.winner === match.playerA ? match.playerB : match.playerA;
		const winnerSeed = match.winner ? participants.get(match.winner)?.seed : null;
		const loserSeed = loserId ? participants.get(loserId)?.seed : null;
		const decider = games.filter((game) => game.match.id === match.id).at(-1);
		if (!decider || winnerSeed == null || loserSeed == null || winnerSeed <= loserSeed) {
			continue;
		}

		if (!best || winnerSeed - loserSeed > best.winnerSeed - best.loserSeed) {
			best = {
				...statGame(decider),
				winner: match.winner!,
				loser: loserId!,
				winnerSeed,
				loserSeed
			};
		}
	}

	return best;
}

function championPath(detail: TournamentDetail): string[] {
	const champion = detail.tournament.winner;
	if (!champion) {
		return [];
	}

	return detail.matches
		.filter(
			(match) =>
				!match.bye &&
				match.status === 'completed' &&
				(match.playerA === champion || match.playerB === champion)
		)
		.sort(
			(a, b) =>
				BRACKET_ORDER[a.bracket] - BRACKET_ORDER[b.bracket] ||
				a.round - b.round ||
				a.position - b.position
		)
		.map((match) => match.id);
}
