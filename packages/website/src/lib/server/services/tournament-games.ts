import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type {
	MyTournamentMatch,
	MyTournaments,
	Tournament,
	TournamentArm,
	TournamentClaim,
	TournamentGameResult,
	TournamentMatch,
	TournamentParticipant,
	TournamentReplay,
	TournamentResultPlayer,
	TournamentSeen,
	TournamentSlot,
	TournamentStart
} from '@company-of-heroes/api';
import type { AuthUserPublic } from '$lib/auth/user';
import { SITE_URL } from '$lib/site/urls';
import { lobbySteamIds } from '../domain/lobby-writes';
import type { HistoryMatch } from '../domain/relic-matches';
import { badRequest, conflict, forbidden, notFound } from '../errors';
import { chunk, ensure, fromPb, inParallel, pbMaybe, type Task } from '../result';
import { Service } from './service';
import {
	CLAIM_ARMED_MS,
	roundsIn,
	toMatch,
	toParticipant,
	withDeadlines,
	type ClaimRecord,
	type MatchRecord,
	type ParticipantRecord
} from './tournaments';

type LobbyResultRecord = {
	id: string;
	sessionId: number;
	map: string;
	players: unknown;
	result: HistoryMatch | null;
	hasReplay: boolean;
	replayDurationSeconds: number;
	durationSeconds: number;
};

/** Seen result popups kept per player (oldest dropped first). */
const SEEN_LIMIT = 300;

const pbDate = (date: Date) => date.toISOString().replace('T', ' ');
const parseDate = (value: string) => Date.parse(value.replace(' ', 'T'));

const slotOf = (match: TournamentMatch, participantId: string): TournamentSlot | null =>
	match.playerA === participantId ? 'A' : match.playerB === participantId ? 'B' : null;

const seenOf = (record: ParticipantRecord): string[] =>
	Array.isArray(record.seenGames) ? record.seenGames.map(String) : [];

type Loaded = {
	userId: string;
	participants: ParticipantRecord[];
	tournaments: Map<string, Tournament>;
	matches: Map<string, TournamentMatch[]>;
	opponents: Map<string, TournamentParticipant>;
};

/**
 * The player side of tournament games: "Start tournament game" in the app arms a claim, the
 * next lobby with the opponent claims it (and is hidden until the tournament ends), and the
 * `tournament-sync` job counts its Relic result. Also the "my tournament" view (dashboard,
 * deadline warnings, result popups) and the overdue notices for staff.
 */
export class TournamentGamesService extends Service {
	private get claims() {
		return this.pb.collection('tournament_claims');
	}

	/** The user's place in a ready match of a running tournament, and the opponent. */
	private seat(
		user: AuthUserPublic,
		matchId: string
	): Task<{
		match: TournamentMatch;
		tournament: string;
		me: ParticipantRecord;
		opponent: ParticipantRecord;
	}> {
		return pbMaybe(
			this.pb
				.collection('tournament_matches')
				.getOne<MatchRecord & { expand?: { tournament?: { status: string } } }>(matchId, {
					expand: 'tournament'
				}),
			'Could not load the match'
		).andThen((record) => {
			if (!record) {
				return errAsync(notFound('Match not found.'));
			}

			const match = toMatch(record);
			if (record.expand?.tournament?.status !== 'in_progress' || match.status !== 'ready') {
				return errAsync(badRequest('This match cannot be played right now.'));
			}

			if (match.manual) {
				return errAsync(badRequest('Staff already set the result of this match.'));
			}

			const ids = [match.playerA, match.playerB].filter((id): id is string => !!id);
			return fromPb(
				this.pb.collection('tournament_participants').getFullList<ParticipantRecord>({
					filter: ids.map((id) => this.pb.filter('id = {:id}', { id })).join(' || ')
				}),
				'Could not load the players'
			).andThen((players) => {
				const me = players.find((p) => p.user === user.id);
				const opponent = players.find((p) => p.user !== user.id);
				if (!me || !opponent) {
					return errAsync(forbidden('You do not play in this match.'));
				}

				return okAsync({ match, tournament: record.tournament, me, opponent });
			});
		});
	}

	/** "Start tournament game": the next lobby with the opponent becomes the tournament game. */
	arm(user: AuthUserPublic, matchId: string): Task<TournamentArm> {
		return this.seat(user, matchId).andThen(({ match, tournament, me, opponent }) => {
			const armedAt = new Date();
			const result: TournamentArm = {
				opponentProfileId: opponent.profileId,
				opponentSteamId: opponent.steamId,
				expiresAt: new Date(armedAt.getTime() + CLAIM_ARMED_MS).toISOString()
			};
			return fromPb(
				this.claims.getList<ClaimRecord>(1, 1, {
					filter: this.pb.filter('match = {:match} && participant = {:me} && status = "armed"', {
						match: match.id,
						me: me.id
					}),
					skipTotal: true
				}),
				'Could not start the tournament game'
			)
				.andThen(({ items }) =>
					fromPb(
						items[0]
							? this.claims.update(items[0].id, { armedAt: pbDate(armedAt) })
							: this.claims.create({
									tournament,
									match: match.id,
									participant: me.id,
									user: user.id,
									status: 'armed',
									armedAt: pbDate(armedAt)
								}),
						'Could not start the tournament game'
					)
				)
				.map(() => result);
		});
	}

	/** The app saw the armed lobby start: tie it to the match and hide it. */
	claim(user: AuthUserPublic, matchId: string, sessionId: number, steamIds: string[]): Task<void> {
		return ensure(Number.isInteger(sessionId) && sessionId > 0, badRequest('sessionId is required'))
			.asyncAndThen(() => this.seat(user, matchId))
			.andThen(({ match, tournament, me, opponent }) =>
				this.checkLobby(sessionId, steamIds, [me.steamId, opponent.steamId])
					.andThen(() =>
						fromPb(
							this.claims.getFullList<ClaimRecord>({
								filter: this.pb.filter(
									'(match = {:match} && participant = {:me} && status = "armed") || sessionId = {:sessionId}',
									{ match: match.id, me: me.id, sessionId }
								)
							}),
							'Could not load the tournament game'
						)
					)
					.andThen((claims) => {
						const existing = claims.find((claim) => claim.sessionId === sessionId);
						const armed = claims.find(
							(claim) =>
								claim.status === 'armed' &&
								claim.participant === me.id &&
								parseDate(claim.armedAt) + CLAIM_ARMED_MS > Date.now()
						);
						if (existing) {
							// The opponent claimed the same lobby first: one claim per game.
							if (existing.match !== match.id) {
								return errAsync(conflict('This lobby is already another tournament game.'));
							}

							return armed
								? fromPb(this.claims.update(armed.id, { status: 'void' }), 'Could not save').map(
										() => undefined
									)
								: okAsync(undefined);
						}

						if (!armed) {
							return errAsync(badRequest('Start the tournament game first.'));
						}

						return fromPb(
							this.claims.update(armed.id, { status: 'playing', sessionId, user: user.id }),
							'Could not save the tournament game'
						)
							.andThen(() =>
								this.services.hiddenMatches.hideForTournament(sessionId, tournament, user.id)
							)
							.map(() => undefined);
					})
			);
	}

	/**
	 * Both players must be in the lobby: what the app reports, and the stored match once it
	 * exists. The result only counts when Relic has both of them in that session anyway.
	 */
	private checkLobby(sessionId: number, reported: string[], needed: string[]): Task<void> {
		const has = (list: string[]) => needed.every((steamId) => list.includes(steamId));
		if (!has(reported)) {
			return errAsync(badRequest('Your opponent is not in this lobby.'));
		}

		return this.services.lobbies
			.bySession(sessionId)
			.andThen((lobby) =>
				!lobby || has(lobbySteamIds(lobby.players))
					? okAsync(undefined)
					: errAsync(badRequest('Your opponent is not in this lobby.'))
			);
	}

	/** Open matches, started games, unseen results and unseen important updates of the player. */
	mine(user: AuthUserPublic): Task<MyTournaments> {
		return ResultAsync.combine([
			this.games(user),
			this.services.tournamentNotices.unseen(user),
			this.hasApp(user)
		]).map(([games, posts, hasApp]) => ({ ...games, posts, hasApp }));
	}

	/**
	 * Whether the player signed in to the desktop app (it stores its version in `meta`), on this
	 * account or another one with the same Steam account.
	 */
	private hasApp(user: AuthUserPublic): Task<boolean> {
		const accounts = [
			this.pb.filter('id = {:id}', { id: user.id }),
			...(user.steamIds ?? []).map((steamId) =>
				this.pb.filter('steamIds ~ {:steamId}', { steamId: `"${steamId}"` })
			)
		];
		return fromPb(
			this.pb.collection('users').getList(1, 1, {
				filter: `(${accounts.join(' || ')}) && meta.version != null && meta.version != ""`,
				fields: 'id',
				skipTotal: true
			}),
			'Could not check the desktop app'
		).map((list) => list.items.length > 0);
	}

	private games(user: AuthUserPublic): Task<Omit<MyTournaments, 'posts' | 'hasApp'>> {
		return this.load(user).andThen((loaded) => {
			if (loaded.participants.length === 0) {
				return okAsync({ matches: [], results: [], started: [] });
			}

			return ResultAsync.combine([this.myClaims(loaded), this.countedLobbies(loaded)]).andThen(
				([claims, counted]) => {
					const open = this.openMatches(loaded, claims);
					const results = this.unseenGames(loaded, counted);
					const lobbyIds = [
						...open.flatMap(({ match }) => match.games.map((game) => game.lobbyId)),
						...results.map(({ lobbyId }) => lobbyId)
					];
					const matchIds = open.map(({ match }) => match.id);
					return ResultAsync.combine([
						this.lobbies(lobbyIds),
						this.services.tournamentSchedule.forMatches(matchIds),
						this.services.tournamentReports.mine(loaded.userId, matchIds)
					]).map(([lobbies, schedules, reports]) => {
						const matches = open.map((item) => ({
							...item,
							schedule: schedules.get(item.match.id) ?? null,
							reports: reports.get(item.match.id) ?? [],
							replays: item.match.games.flatMap((game): TournamentReplay[] => {
								const lobby = lobbies.get(game.lobbyId);
								return lobby?.hasReplay
									? [
											{
												lobbyId: lobby.id,
												map: lobby.map || '',
												durationSeconds: lobby.replayDurationSeconds || null
											}
										]
									: [];
							})
						}));
						return {
							matches,
							results: results.flatMap((item) => {
								const lobby = lobbies.get(item.lobbyId);
								return lobby ? [this.result(item, lobby, loaded)] : [];
							}),
							started: this.started(loaded, matches)
						};
					});
				}
			);
		});
	}

	/** The user's places in running and finished tournaments, with their tournaments and matches. */
	private load(user: AuthUserPublic): Task<Loaded> {
		return fromPb(
			this.pb.collection('tournament_participants').getFullList<ParticipantRecord>({
				filter: this.pb.filter(
					'user = {:user} && status = "registered" && ' +
						'(tournament.status = "in_progress" || tournament.status = "completed") && ' +
						'tournament.updated > {:since}',
					// Finished long ago: nothing left to show.
					{ user: user.id, since: pbDate(new Date(Date.now() - 30 * 86_400_000)) }
				)
			}),
			'Could not load your tournaments'
		).andThen((participants) => {
			const tournamentIds = [...new Set(participants.map((p) => p.tournament))];
			if (tournamentIds.length === 0) {
				return okAsync({
					userId: user.id,
					participants,
					tournaments: new Map(),
					matches: new Map(),
					opponents: new Map()
				});
			}

			const byTournament = tournamentIds
				.map((id) => this.pb.filter('tournament = {:id}', { id }))
				.join(' || ');
			return ResultAsync.combine([
				this.services.tournaments.summaries(tournamentIds),
				fromPb(
					this.pb
						.collection('tournament_matches')
						.getFullList<MatchRecord>({ filter: byTournament, sort: 'round,position' }),
					'Could not load your matches'
				),
				fromPb(
					this.pb
						.collection('tournament_participants')
						.getFullList<ParticipantRecord>({ filter: byTournament }),
					'Could not load your opponents'
				)
			]).map(([tournaments, matchRecords, everyone]) => {
				const byId = new Map(tournaments.map((t) => [t.id, t]));
				const matches = new Map<string, TournamentMatch[]>();
				for (const tournament of tournaments) {
					const own = matchRecords.filter((m) => m.tournament === tournament.id).map(toMatch);
					matches.set(tournament.id, withDeadlines(tournament, own));
				}

				return {
					userId: user.id,
					participants,
					tournaments: byId,
					matches,
					opponents: new Map(everyone.map((p) => [p.id, toParticipant(p, byId.get(p.tournament))]))
				};
			});
		});
	}

	/** Armed and playing claims in the tournaments the user plays in. */
	private myClaims(loaded: Loaded): Task<ClaimRecord[]> {
		// Either player may have started the game: claims by tournament, not by the user.
		const tournaments = [...loaded.tournaments.keys()].map((id) =>
			this.pb.filter('tournament = {:id}', { id })
		);
		if (tournaments.length === 0) {
			return okAsync([]);
		}

		return fromPb(
			this.claims.getFullList<ClaimRecord>({
				filter: `(status = "armed" || status = "playing") && (${tournaments.join(' || ')})`
			}),
			'Could not load your tournament games'
		);
	}

	/** Lobbies of games counted from claims (by anyone) in the user's matches. */
	private countedLobbies(loaded: Loaded): Task<Set<string>> {
		const tournaments = [...loaded.tournaments.keys()].map((id) =>
			this.pb.filter('tournament = {:id}', { id })
		);
		if (tournaments.length === 0) {
			return okAsync(new Set());
		}

		return fromPb(
			this.claims.getFullList<{ lobby: string }>({
				filter: `status = "counted" && (${tournaments.join(' || ')})`,
				fields: 'lobby'
			}),
			'Could not load your tournament games'
		).map((rows) => new Set(rows.map((row) => row.lobby).filter(Boolean)));
	}

	private openMatches(
		loaded: Loaded,
		claims: ClaimRecord[]
	): Omit<MyTournamentMatch, 'replays' | 'schedule' | 'reports'>[] {
		return loaded.participants.flatMap((record) => {
			const tournament = loaded.tournaments.get(record.tournament);
			const matches = loaded.matches.get(record.tournament) ?? [];
			if (!tournament || tournament.status !== 'in_progress') {
				return [];
			}

			return matches.flatMap((match) => {
				const mySlot = slotOf(match, record.id);
				if (!mySlot || match.status !== 'ready' || match.bye) {
					return [];
				}

				const opponentId = mySlot === 'A' ? match.playerB : match.playerA;
				const own = claims.filter((claim) => claim.match === match.id);
				const playing = own.find((claim) => claim.status === 'playing');
				// "Waiting for the lobby" is only the player's own.
				const armed = own.find(
					(claim) =>
						claim.status === 'armed' &&
						claim.participant === record.id &&
						parseDate(claim.armedAt) + CLAIM_ARMED_MS > Date.now()
				);
				const claim: TournamentClaim | null = playing
					? { status: 'playing', expiresAt: null }
					: armed
						? {
								status: 'armed',
								expiresAt: new Date(parseDate(armed.armedAt) + CLAIM_ARMED_MS).toISOString()
							}
						: null;
				return [
					{
						tournament: pickTournament(tournament),
						match: { ...match, playing: !!playing },
						rounds: roundsIn(matches, match.bracket),
						me: toParticipant(record, tournament),
						mySlot,
						opponent: (opponentId && loaded.opponents.get(opponentId)) || null,
						claim
					}
				];
			});
		});
	}

	/** Counted games in the user's matches whose result popup they have not seen yet. */
	private unseenGames(
		loaded: Loaded,
		counted: Set<string>
	): { lobbyId: string; participant: ParticipantRecord; match: TournamentMatch; index: number }[] {
		return loaded.participants.flatMap((record) => {
			const seen = new Set(seenOf(record));
			return (loaded.matches.get(record.tournament) ?? []).flatMap((match) =>
				slotOf(match, record.id)
					? match.games.flatMap((game, index) =>
							counted.has(game.lobbyId) && !seen.has(game.lobbyId)
								? [{ lobbyId: game.lobbyId, participant: record, match, index }]
								: []
						)
					: []
			);
		});
	}

	/**
	 * Running tournaments whose start popup the player has not seen and in which they have not
	 * played a game yet: a popup for a tournament that is well under way would be news to no one.
	 */
	private started(loaded: Loaded, open: MyTournamentMatch[]): TournamentStart[] {
		return loaded.participants.flatMap((record) => {
			const tournament = loaded.tournaments.get(record.tournament);
			if (!tournament || tournament.status !== 'in_progress' || record.startSeenAt) {
				return [];
			}

			const played = (loaded.matches.get(record.tournament) ?? []).some(
				(match) => slotOf(match, record.id) && match.games.length > 0
			);
			if (played) {
				return [];
			}

			return [
				{
					tournament: {
						...pickTournament(tournament),
						bannerUrl: tournament.bannerUrl,
						participantCount: tournament.participantCount
					},
					match: open.find((item) => item.me.id === record.id) ?? null
				}
			];
		});
	}

	/** Lobbies by id, hidden ones included (only ever the user's own games). */
	private lobbies(ids: string[]): Task<Map<string, LobbyResultRecord>> {
		const unique = [...new Set(ids)];
		if (unique.length === 0) {
			return okAsync(new Map());
		}

		return inParallel(chunk(unique, 50), 3, (slice) =>
			fromPb(
				this.pb.collection('lobbies').getFullList<LobbyResultRecord>({
					filter: slice.map((id) => this.pb.filter('id = {:id}', { id })).join(' || '),
					fields: 'id,sessionId,map,players,result,hasReplay,replayDurationSeconds,durationSeconds'
				}),
				'Could not load your games'
			)
		).map((pages) => new Map(pages.flat().map((lobby) => [lobby.id, lobby])));
	}

	private result(
		item: {
			lobbyId: string;
			participant: ParticipantRecord;
			match: TournamentMatch;
			index: number;
		},
		lobby: LobbyResultRecord,
		loaded: Loaded
	): TournamentGameResult {
		const { match, participant, index } = item;
		const tournament = loaded.tournaments.get(participant.tournament)!;
		const mySlot = slotOf(match, participant.id)!;
		const game = match.games[index];
		const seats = [
			['A', match.playerA],
			['B', match.playerB]
		] as const;
		const players = seats.flatMap(([slot, id]): TournamentResultPlayer[] => {
			const seat = id ? loaded.opponents.get(id) : undefined;
			if (!seat) {
				return [];
			}

			const played = lobby.result?.players?.find((p) => p.profile_id === seat.profileId);
			return [
				{
					slot,
					alias: played?.alias || seat.alias,
					steamId: seat.steamId,
					profileId: seat.profileId,
					raceId: played?.race_id ?? null,
					outcome: played?.outcome ?? (game.winner === slot ? 1 : 0),
					oldRating: played?.oldrating ?? null,
					newRating: played?.newrating ?? null
				}
			];
		});
		const isLast = index === match.games.length - 1;
		const wonMatch = match.status === 'completed' && match.winner === participant.id && isLast;
		return {
			lobbyId: lobby.id,
			tournament: pickTournament(tournament),
			match: {
				id: match.id,
				bracket: match.bracket,
				round: match.round,
				bestOf: match.bestOf,
				// The score right after this game.
				winsA: match.games.slice(0, index + 1).filter((g) => g.winner === 'A').length,
				winsB: match.games.slice(0, index + 1).filter((g) => g.winner === 'B').length,
				status: isLast ? match.status : 'ready'
			},
			rounds: roundsIn(loaded.matches.get(participant.tournament) ?? [], match.bracket),
			mySlot,
			gameNumber: index + 1,
			won: game.winner === mySlot,
			wonMatch,
			wonTournament:
				wonMatch && tournament.status === 'completed' && tournament.winner === participant.id,
			map: lobby.map || lobby.result?.mapname || '',
			durationSeconds: lobby.durationSeconds || lobby.replayDurationSeconds || null,
			players
		};
	}

	/** The result popups of these games, and the start popups of these tournaments, were shown. */
	markSeen(user: AuthUserPublic, seen: TournamentSeen): Task<void> {
		return ResultAsync.combine([
			this.markGamesSeen(user, seen.lobbyIds ?? [], seen.started ?? []),
			this.services.tournamentNotices.markPostsSeen(user, seen.posts ?? [])
		]).map(() => undefined);
	}

	private markGamesSeen(user: AuthUserPublic, lobbyIds: string[], started: string[]): Task<void> {
		const valid = (list: string[]) => [...new Set(list.filter((id) => /^[a-z0-9]{15}$/.test(id)))];
		const ids = valid(lobbyIds);
		const tournaments = new Set(valid(started));
		if (ids.length === 0 && tournaments.size === 0) {
			return okAsync(undefined);
		}

		return this.load(user).andThen((loaded) => {
			const changed = loaded.participants.flatMap((record) => {
				const games = new Set(
					(loaded.matches.get(record.tournament) ?? []).flatMap((match) =>
						slotOf(match, record.id) ? match.games.map((game) => game.lobbyId) : []
					)
				);
				const add = ids.filter((id) => games.has(id));
				const start = tournaments.has(record.tournament) && !record.startSeenAt;
				if (add.length === 0 && !start) {
					return [];
				}

				const data = {
					...(add.length > 0 && {
						seenGames: [...new Set([...seenOf(record), ...add])].slice(-SEEN_LIMIT)
					}),
					...(start && { startSeenAt: pbDate(new Date()) })
				};
				return [{ id: record.id, data }];
			});
			return inParallel(changed, 5, ({ id, data }) =>
				fromPb(this.pb.collection('tournament_participants').update(id, data), 'Could not save')
			).map(() => undefined);
		});
	}

	/** The `tournament-deadlines` job: staff hear once about every ready match past its deadline. */
	notifyOverdue(): Task<{ processed: number; more: boolean }> {
		return fromPb(
			this.pb.collection('tournament_matches').getFullList<MatchRecord>({
				filter:
					'status = "ready" && manual = false && overdueNotifiedAt = "" && tournament.status = "in_progress"'
			}),
			'Could not load tournament matches'
		).andThen((records) => {
			const tournamentIds = [...new Set(records.map((r) => r.tournament))];
			return this.services.tournaments.summaries(tournamentIds).andThen((tournaments) => {
				const overdue = tournaments.flatMap((tournament) =>
					withDeadlines(
						tournament,
						records.filter((r) => r.tournament === tournament.id).map(toMatch)
					)
						.filter((match) => match.deadline && Date.parse(match.deadline) < Date.now())
						.map((match) => ({ tournament, match }))
				);
				if (overdue.length === 0) {
					return okAsync({ processed: 0, more: false });
				}

				return this.names(overdue.map((o) => o.match))
					.andThen((names) =>
						inParallel(overdue, 3, ({ tournament, match }) =>
							this.services.tournamentNotices
								.managerIds(tournament.id)
								.andThen((staff) => this.notifyStaff(staff, tournament, match, names))
								.andThen(() =>
									fromPb(
										this.pb
											.collection('tournament_matches')
											.update(match.id, { overdueNotifiedAt: pbDate(new Date()) }),
										'Could not save the match'
									)
								)
						)
					)
					.map(() => ({ processed: overdue.length, more: false }));
			});
		});
	}

	private names(matches: TournamentMatch[]): Task<Map<string, string>> {
		const ids = [...new Set(matches.flatMap((m) => [m.playerA, m.playerB]).filter(Boolean))];
		if (ids.length === 0) {
			return okAsync(new Map());
		}

		return fromPb(
			this.pb.collection('tournament_participants').getFullList<{ id: string; alias: string }>({
				filter: ids.map((id) => this.pb.filter('id = {:id}', { id })).join(' || '),
				fields: 'id,alias'
			}),
			'Could not load the players'
		).map((rows) => new Map(rows.map((row) => [row.id, row.alias])));
	}

	private notifyStaff(
		staff: string[],
		tournament: Tournament,
		match: TournamentMatch,
		names: Map<string, string>
	): Task<void> {
		if (staff.length === 0) {
			return okAsync(undefined);
		}

		const name = (id: string | null) => (id && names.get(id)) || 'TBD';
		const url = `${SITE_URL}/tournaments/${tournament.slug}`;
		const round =
			match.bracket === 'round_robin'
				? `round ${match.round}`
				: `${match.bracket} round ${match.round}`;
		return fromPb(
			this.pb.collection('notifications').create({
				title: `Tournament match overdue: ${tournament.name}`.slice(0, 200),
				body:
					`**${name(match.playerA)}** vs **${name(match.playerB)}** (${round}) passed its ` +
					`deadline without a result. Set a result or give them a new deadline on the [tournament page](${url}).`,
				targetAll: false,
				recipients: staff,
				url
			}),
			'Could not notify staff'
		).map(() => undefined);
	}
}

function pickTournament(tournament: Tournament): MyTournamentMatch['tournament'] {
	return {
		id: tournament.id,
		name: tournament.name,
		slug: tournament.slug,
		format: tournament.format,
		logoUrl: tournament.logoUrl,
		medal: tournament.medal
	};
}
