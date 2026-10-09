import { err, errAsync, ok, okAsync, ResultAsync, type Result } from 'neverthrow';
import {
	TOURNAMENT_BANNER_MAX_BYTES,
	TOURNAMENT_IMAGE_TYPES,
	TOURNAMENT_LOGO_MAX_BYTES,
	TOURNAMENT_MAP_ICON_MAX_BYTES,
	CUSTOM_MAP_PREFIX,
	customMapId,
	isBuiltInMap,
	roundKey,
	winsNeeded,
	type Tournament,
	type TournamentDetail,
	type TournamentFormat,
	type TournamentGame,
	type TournamentImages,
	type TournamentInput,
	type TournamentMap,
	type TournamentMatch,
	type TournamentMatchResult,
	type TournamentParticipant,
	type TournamentPost,
	type TournamentPostInput,
	type TournamentReplay,
	type TournamentReport,
	type TournamentScope,
	type TournamentSlot,
	type TournamentStatus,
	type TournamentUpdate
} from '@company-of-heroes/api';
import { canManageTournament, isStaffUser, meSteamIds, type AuthUserPublic } from '$lib/auth/user';
import {
	buildBracket,
	champion,
	forfeitAll,
	isFinished,
	placements,
	reopenMatch,
	resolveMatch,
	settleStart,
	standings
} from '../domain/tournament-bracket';
import { workshopMap } from '@company-of-heroes/game-data/maps';
import { mapDisplayName } from '../domain/map-name';
import { badRequest, conflict, forbidden, notFound, type AppError } from '../errors';
import { chunk, ensure, fromPb, inParallel, pbMaybe, sequence, type Task } from '../result';
import { Service } from './service';

/** Paths next to `/tournaments/[slug]`: a tournament with this slug could not be opened. */
const RESERVED_SLUGS = [
	'new',
	'maps',
	'me',
	'won',
	'hall-of-fame',
	'host-requests',
	'hosts',
	'simulate'
];

/** Started tournament games checked per sync run. */
const SYNC_BATCH = 100;
/** "Start tournament game" waits this long for the lobby with the opponent. */
export const CLAIM_ARMED_MS = 2 * 60 * 60 * 1000;
/** A started game without a counted result by then (abandoned, no Relic result) is dropped. */
const CLAIM_PLAYING_MS = 12 * 60 * 60 * 1000;

/** A "Start tournament game" claim (see `tournament-games.ts`). */
export type ClaimRecord = {
	id: string;
	tournament: string;
	match: string;
	participant: string;
	user: string;
	sessionId: number;
	lobby: string;
	status: 'armed' | 'playing' | 'counted' | 'void';
	armedAt: string;
	processedAt: string;
	created: string;
};

type TournamentRecord = {
	id: string;
	name: string;
	slug: string;
	description: string;
	rules: string;
	format: TournamentFormat;
	bestOf: number;
	finalsBestOf: number;
	grandFinalReset: boolean;
	status: TournamentStatus;
	registrationClosesAt: string;
	startsAt: string;
	maxParticipants: number;
	mapPool: unknown;
	winner: string;
	banner: string;
	logo: string;
	medal: string;
	roundDeadlines: unknown;
	rulesUpdatedAt: string;
	streamUrl: string;
	featuredMatch: string;
	autoClosedAt: string;
	/** The staff member or community host who created it. */
	createdBy: string;
	collectionName: string;
	created: string;
	expand?: { winner?: { alias?: string } };
};

/** `true` for internal calls and checked staff actions; otherwise the viewer (or nobody). */
type Access = true | false | AuthUserPublic | null;

export type ParticipantRecord = Omit<
	TournamentParticipant,
	'rating' | 'highestRating' | 'seed' | 'placement' | 'rulesAccepted'
> & {
	tournament: string;
	rating: number;
	seed: number;
	placement: number;
	/** Processed tournament games (lobby ids) whose result popup the player has seen. */
	seenGames?: unknown;
	/** When the player saw the "tournament has started" popup. */
	startSeenAt?: string;
	/** When the player heard they are out (elimination brackets). */
	outNotifiedAt?: string;
	/** When the player last accepted the rules. */
	rulesAcceptedAt?: string;
	created: string;
	/** Not stored: filled from the live ratings lookup. */
	highestRating?: number | null;
};

export type MatchRecord = Omit<
	TournamentMatch,
	| 'playerA'
	| 'playerB'
	| 'winner'
	| 'readyAt'
	| 'nextMatch'
	| 'nextSlot'
	| 'loserNextMatch'
	| 'loserNextSlot'
	| 'games'
	| 'deadline'
	| 'deadlineOverride'
	| 'playing'
	| 'scheduledAt'
> & {
	deadline: string;
	scheduledAt: string;
	overdueNotifiedAt: string;
	tournament: string;
	playerA: string;
	playerB: string;
	winner: string;
	readyAt: string;
	nextMatch: string;
	nextSlot: string;
	loserNextMatch: string;
	loserNextSlot: string;
	games: unknown;
};

type IndexGame = {
	lobby: string;
	profile_id: number;
	outcome: number;
	session_id: number;
	expand?: { lobby?: { createdAt?: string } };
};

const OPEN: TournamentStatus[] = ['registration', 'seeding'];

const orNull = (value: string | null | undefined) => value || null;

const slotOrNull = (value: string): TournamentSlot | null =>
	value === 'A' || value === 'B' ? value : null;

const pbDate = (date: Date) => date.toISOString().replace('T', ' ');

const parseDate = (value: string) => Date.parse(value.replace(' ', 'T'));

type Resolved = Pick<Tournament, 'bannerUrl' | 'logoUrl' | 'mapPool'>;

type MapRecord = { id: string; name: string; icon: string; collectionName: string };

const poolRefs = (record: Pick<TournamentRecord, 'mapPool'>) =>
	Array.isArray(record.mapPool) ? record.mapPool.map(String) : [];

/** Stored round deadlines; keys and dates are checked on write. */
function roundDeadlinesOf(
	record: Pick<TournamentRecord, 'roundDeadlines'>
): Record<string, string> {
	const value = record.roundDeadlines;
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return {};
	}

	return Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
	);
}

/** Each match's effective deadline: its own override, else its round's. */
export function withDeadlines(
	record: Pick<TournamentRecord, 'roundDeadlines'>,
	matches: TournamentMatch[]
): TournamentMatch[] {
	const rounds = roundDeadlinesOf(record);
	return matches.map((match) => ({
		...match,
		deadline: match.deadlineOverride ?? rounds[roundKey(match)] ?? null
	}));
}

/** Rounds in a bracket (for round labels like "Final"). */
export function roundsIn(matches: TournamentMatch[], bracket: TournamentMatch['bracket']): number {
	return Math.max(0, ...matches.filter((m) => m.bracket === bracket).map((m) => m.round));
}

function toTournament(
	record: TournamentRecord,
	participantCount: number,
	resolved: Resolved
): Tournament {
	return {
		id: record.id,
		name: record.name,
		slug: record.slug,
		description: record.description ?? '',
		rules: record.rules ?? '',
		format: record.format,
		bestOf: record.bestOf || 1,
		finalsBestOf: record.finalsBestOf || null,
		grandFinalReset: Boolean(record.grandFinalReset),
		status: record.status,
		registrationClosesAt: orNull(record.registrationClosesAt),
		startsAt: orNull(record.startsAt),
		maxParticipants: record.maxParticipants || null,
		winner: orNull(record.winner),
		champion: orNull(record.expand?.winner?.alias),
		medal: orNull(record.medal),
		roundDeadlines: roundDeadlinesOf(record),
		rulesUpdatedAt: orNull(record.rulesUpdatedAt),
		streamUrl: orNull(record.streamUrl),
		featuredMatch: orNull(record.featuredMatch),
		liveCount: 0,
		...resolved,
		participantCount,
		created: record.created
	};
}

type TournamentRules = { rules?: string; rulesUpdatedAt?: string | null };

/**
 * Whether the participant accepted the tournament's current rules. Without the tournament (or
 * without rules) there is nothing to accept.
 */
export function rulesAccepted(
	record: Pick<ParticipantRecord, 'rulesAcceptedAt'>,
	tournament?: TournamentRules
): boolean {
	if (!tournament?.rules?.trim()) {
		return true;
	}

	const accepted = record.rulesAcceptedAt ? parseDate(record.rulesAcceptedAt) : NaN;
	const changed = tournament.rulesUpdatedAt ? parseDate(tournament.rulesUpdatedAt) : NaN;
	if (Number.isNaN(accepted)) {
		// Signed up before sign-up asked for it: they agreed to these rules by joining, until
		// staff change them.
		return Number.isNaN(changed);
	}

	return Number.isNaN(changed) || accepted >= changed;
}

export function toParticipant(
	record: ParticipantRecord,
	tournament?: TournamentRules
): TournamentParticipant {
	return {
		id: record.id,
		user: record.user,
		steamId: record.steamId,
		profileId: record.profileId,
		alias: record.alias,
		country: record.country ?? '',
		rating: record.rating || null,
		highestRating: record.highestRating ?? null,
		seed: record.seed || null,
		status: record.status,
		placement: record.placement || null,
		rulesAccepted: rulesAccepted(record, tournament)
	};
}

export function toMatch(record: MatchRecord): TournamentMatch {
	return {
		id: record.id,
		bracket: record.bracket,
		round: record.round,
		position: record.position,
		bestOf: record.bestOf || 1,
		playerA: orNull(record.playerA),
		playerB: orNull(record.playerB),
		winsA: record.winsA || 0,
		winsB: record.winsB || 0,
		winner: orNull(record.winner),
		status: record.status,
		readyAt: orNull(record.readyAt),
		nextMatch: orNull(record.nextMatch),
		nextSlot: slotOrNull(record.nextSlot),
		loserNextMatch: orNull(record.loserNextMatch),
		loserNextSlot: slotOrNull(record.loserNextSlot),
		games: Array.isArray(record.games) ? (record.games as TournamentGame[]) : [],
		manual: Boolean(record.manual),
		bye: Boolean(record.bye),
		deadline: orNull(record.deadline),
		deadlineOverride: orNull(record.deadline),
		playing: false,
		scheduledAt: orNull(record.scheduledAt)
	};
}

/** The writable columns of a match. */
function matchFields(match: TournamentMatch) {
	return {
		playerA: match.playerA ?? '',
		playerB: match.playerB ?? '',
		winsA: match.winsA,
		winsB: match.winsB,
		winner: match.winner ?? '',
		status: match.status,
		readyAt: match.readyAt ?? '',
		games: match.games,
		manual: match.manual,
		bye: match.bye
	};
}

/** Record fields for new or removed images; checks type and size. */
function imageFields(images: TournamentImages): Result<Record<string, unknown>, AppError> {
	const fields: Record<string, unknown> = {};
	const checks = [
		[
			'banner',
			images.banner,
			images.clearBanner,
			TOURNAMENT_BANNER_MAX_BYTES,
			'The banner must be 5 MB or smaller.'
		],
		[
			'logo',
			images.logo,
			images.clearLogo,
			TOURNAMENT_LOGO_MAX_BYTES,
			'The logo must be 2 MB or smaller.'
		]
	] as const;
	for (const [name, file, clear, maxBytes, tooBig] of checks) {
		if (file) {
			if (!TOURNAMENT_IMAGE_TYPES.includes(file.type)) {
				return err(badRequest('Use a JPEG, PNG or WebP image.'));
			}

			if (file.size > maxBytes) {
				return err(badRequest(tooBig));
			}

			fields[name] = file;
		} else if (clear) {
			fields[name] = null;
		}
	}

	return ok(fields);
}

function slugify(name: string): string {
	return (
		name
			.normalize('NFKD')
			.replace(/\p{Diacritic}/gu, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 100) || 'tournament'
	);
}

/** Highest rating over every ladder (all match types and factions). */
function highestElo(elo: Record<string, Record<string, { rating: number }>>): number | null {
	const ratings = Object.values(elo).flatMap((mode) =>
		Object.values(mode ?? {}).map((slot) => slot.rating)
	);
	return ratings.length ? Math.max(...ratings) : null;
}

/** Highest 1v1 rating over all factions (Relic match type 1). */
function oneVsOneElo(elo: Record<string, Record<string, { rating: number }>>): number | null {
	const ratings = Object.values(elo['1'] ?? {}).map((slot) => slot.rating);
	return ratings.length ? Math.max(...ratings) : null;
}

/**
 * 1v1 tournaments. Staff create and run them, signed-in users sign up with a linked
 * Steam account. Brackets come from `domain/tournament-bracket`; match scores are filled
 * from the Relic results of started tournament games by `sync()` (the `tournament-sync` job,
 * see `tournament-games.ts`), or set by staff.
 */
export class TournamentsService extends Service {
	private get tournaments() {
		return this.pb.collection('tournaments');
	}

	private get participants() {
		return this.pb.collection('tournament_participants');
	}

	private get matches() {
		return this.pb.collection('tournament_matches');
	}

	private get maps() {
		return this.pb.collection('tournament_maps');
	}

	/** `custom` resolves the `custom:<id>` references; a deleted custom map drops out of the pool. */
	private view(
		record: TournamentRecord,
		participantCount: number,
		custom: Map<string, TournamentMap>
	): Tournament {
		const url = (file: string, thumb: string) =>
			file ? this.pb.files.getURL(record, file, { thumb }) : null;
		const mapPool = poolRefs(record).flatMap((ref): TournamentMap[] => {
			if (isBuiltInMap(ref)) {
				return [{ ref, name: mapDisplayName(ref), imageUrl: null, source: 'stock' }];
			}

			const workshop = workshopMap(ref);
			if (workshop) {
				return [{ ref, name: workshop.name, imageUrl: null, source: 'workshop' }];
			}

			const map = custom.get(ref);
			return map ? [map] : [];
		});
		return toTournament(record, participantCount, {
			bannerUrl: url(record.banner, '1200x300'),
			logoUrl: url(record.logo, '128x128'),
			mapPool
		});
	}

	private toMap(record: MapRecord): TournamentMap {
		return {
			ref: `${CUSTOM_MAP_PREFIX}${record.id}`,
			name: record.name,
			imageUrl: record.icon
				? this.pb.files.getURL(record, record.icon, { thumb: '256x256' })
				: null,
			source: 'custom'
		};
	}

	/** Custom maps behind these references, by reference. */
	private customMaps(refs: string[]): Task<Map<string, TournamentMap>> {
		const ids = [...new Set(refs.map(customMapId).filter((id): id is string => Boolean(id)))];
		if (ids.length === 0) {
			return okAsync(new Map());
		}

		return fromPb(
			this.maps.getFullList<MapRecord>({
				filter: ids.map((id) => this.pb.filter('id = {:id}', { id })).join(' || ')
			}),
			'Could not load the maps'
		).map(
			(records) =>
				new Map(records.map((record) => [`${CUSTOM_MAP_PREFIX}${record.id}`, this.toMap(record)]))
		);
	}

	/** Every staff-made map, for the map pool picker. */
	listMaps(): Task<TournamentMap[]> {
		return fromPb(
			this.maps.getFullList<MapRecord>({ sort: 'name' }),
			'Could not load the maps'
		).map((records) => records.map((record) => this.toMap(record)));
	}

	/** Staff add a map that is not built in, with its icon. */
	createMap(name: string, icon: File | null, staffId: string): Task<TournamentMap> {
		const trimmed = name.trim();
		return ensure(trimmed.length > 0 && trimmed.length <= 80, badRequest('Give the map a name.'))
			.andThen(() =>
				ensure(
					!icon || TOURNAMENT_IMAGE_TYPES.includes(icon.type),
					badRequest('Use a JPEG, PNG or WebP image.')
				)
			)
			.andThen(() =>
				ensure(
					!icon || icon.size <= TOURNAMENT_MAP_ICON_MAX_BYTES,
					badRequest('The map icon must be 2 MB or smaller.')
				)
			)
			.asyncAndThen(() =>
				fromPb(
					this.maps.create<MapRecord>({
						name: trimmed,
						createdBy: staffId,
						...(icon ? { icon } : {})
					}),
					'Could not add the map'
				)
			)
			.map((record) => this.toMap(record));
	}

	/** Drafts are listed for staff, and for a host only their own. */
	list(scope: TournamentScope, viewer: AuthUserPublic | null): Task<Tournament[]> {
		const staff = isStaffUser(viewer);
		const statuses: Record<TournamentScope, TournamentStatus[]> = {
			active: ['in_progress'],
			upcoming: staff ? ['draft', ...OPEN] : OPEN,
			past: ['completed', 'cancelled']
		};
		const shown = statuses[scope].map((status) => `status = "${status}"`).join(' || ');
		const filter =
			scope === 'upcoming' && !staff && viewer?.role === 'host'
				? `${shown} || ${this.pb.filter('(status = "draft" && createdBy = {:me})', { me: viewer.id })}`
				: shown;
		return fromPb(
			this.tournaments.getList<TournamentRecord>(1, 50, {
				filter,
				sort: scope === 'past' ? '-startsAt,-created' : 'startsAt,created',
				expand: scope === 'past' ? 'winner' : undefined,
				skipTotal: true
			}),
			'Could not load tournaments'
		)
			.andThen(({ items }) => this.withCounts(items))
			.andThen((tournaments) =>
				scope === 'active' ? this.withLiveCounts(tournaments) : okAsync(tournaments)
			);
	}

	/** Fills `liveCount`: started tournament games being played right now, per tournament. */
	private withLiveCounts(tournaments: Tournament[]): Task<Tournament[]> {
		if (tournaments.length === 0) {
			return okAsync(tournaments);
		}

		const ids = tournaments
			.map((tournament) => this.pb.filter('tournament = {:id}', { id: tournament.id }))
			.join(' || ');
		return fromPb(
			this.pb.collection('tournament_claims').getFullList<{ tournament: string; match: string }>({
				filter: `status = "playing" && (${ids})`,
				fields: 'tournament,match'
			}),
			'Could not load tournaments'
		).map((rows) => {
			const live = new Map<string, Set<string>>();
			for (const row of rows) {
				live.set(row.tournament, (live.get(row.tournament) ?? new Set()).add(row.match));
			}

			return tournaments.map((tournament) => ({
				...tournament,
				liveCount: live.get(tournament.id)?.size ?? 0
			}));
		});
	}

	/** Finished tournaments the player with this Steam id won, newest first. */
	wonBy(steamId: string): Task<Tournament[]> {
		return fromPb(
			this.tournaments.getList<TournamentRecord>(1, 50, {
				filter: this.pb.filter('status = "completed" && winner.steamId = {:steamId}', { steamId }),
				sort: '-startsAt,-created',
				skipTotal: true
			}),
			'Could not load tournaments'
		).andThen(({ items }) => this.withCounts(items));
	}

	private withCounts(records: TournamentRecord[]): Task<Tournament[]> {
		if (records.length === 0) {
			return okAsync([]);
		}

		// Chunked: one OR filter over every finished tournament outgrows a URL.
		return ResultAsync.combine([
			sequence(chunk(records, 50), (part) =>
				fromPb(
					this.participants.getFullList<{ tournament: string }>({
						filter: `status = "registered" && (${part
							.map((record) => this.pb.filter('tournament = {:id}', { id: record.id }))
							.join(' || ')})`,
						fields: 'tournament'
					}),
					'Could not load tournaments'
				)
			).map((lists) => lists.flat()),
			this.customMaps(records.flatMap(poolRefs))
		]).map(([rows, custom]) => {
			const counts = new Map<string, number>();
			for (const row of rows) {
				counts.set(row.tournament, (counts.get(row.tournament) ?? 0) + 1);
			}

			return records.map((record) => this.view(record, counts.get(record.id) ?? 0, custom));
		});
	}

	/** The id of a tournament given by id or slug (drafts only for whoever may run it). */
	idOf(idOrSlug: string, viewer: Access): Task<string> {
		return this.record(idOrSlug, viewer).map((record) => record.id);
	}

	/**
	 * The id of a tournament the user may run: staff run every tournament, a host the ones they
	 * created. Routes call this before any staff action.
	 */
	managed(idOrSlug: string, user: AuthUserPublic): Task<string> {
		return this.record(idOrSlug, true).andThen((record) =>
			canManageTournament(user, record)
				? okAsync(record.id)
				: record.status === 'draft'
					? errAsync(notFound('Tournament not found.'))
					: errAsync(forbidden('Only staff or the host of this tournament can do that.'))
		);
	}

	/** `true`: drafts included (internal calls, checked actions); a viewer sees drafts they run. */
	private record(idOrSlug: string, access: Access): Task<TournamentRecord> {
		return pbMaybe(
			this.tournaments.getFirstListItem<TournamentRecord>(
				this.pb.filter('id = {:value} || slug = {:value}', { value: idOrSlug })
			),
			'Could not load the tournament'
		).andThen((record) =>
			record &&
			(record.status !== 'draft' ||
				access === true ||
				(typeof access === 'object' && canManageTournament(access, record)))
				? okAsync(record)
				: errAsync(notFound('Tournament not found.'))
		);
	}

	private participantRecords(tournamentId: string): Task<ParticipantRecord[]> {
		return fromPb(
			this.participants.getFullList<ParticipantRecord>({
				filter: this.pb.filter('tournament = {:id}', { id: tournamentId }),
				sort: 'created'
			}),
			'Could not load the players'
		);
	}

	private matchList(tournamentId: string): Task<TournamentMatch[]> {
		return fromPb(
			this.matches.getFullList<MatchRecord>({
				filter: this.pb.filter('tournament = {:id}', { id: tournamentId }),
				sort: 'round,position'
			}),
			'Could not load the matches'
		).map((records) => records.map(toMatch));
	}

	get(idOrSlug: string, viewer: Access): Task<TournamentDetail> {
		return this.record(idOrSlug, viewer).andThen((record) => this.detail(record));
	}

	/** The community host who created it (null when staff did, or the role was taken away). */
	private hostOf(record: TournamentRecord): Task<TournamentDetail['host']> {
		if (!record.createdBy) {
			return okAsync(null);
		}

		return pbMaybe(
			this.pb
				.collection('users')
				.getOne<{ id: string; name: string; role: string }>(record.createdBy, {
					fields: 'id,name,role'
				}),
			'Could not load the host'
		).map((user) => (user?.role === 'host' ? { id: user.id, name: user.name || 'Host' } : null));
	}

	/** `canManage` (and the open reports) follow the signed-in user of this request. */
	private detail(record: TournamentRecord): Task<TournamentDetail> {
		const canManage = canManageTournament(this.locals.user, record);
		return ResultAsync.combine([
			this.participantRecords(record.id).andThen((records) =>
				this.withLiveRatings(record, records)
			),
			this.matchList(record.id).andThen((matches) =>
				ResultAsync.combine([this.replaysOf(matches), this.playingMatches(record.id)]).map(
					([replays, playing]) => ({
						matches: withDeadlines(record, matches).map((match) => ({
							...match,
							playing: playing.has(match.id)
						})),
						replays,
						live: playing.size
					})
				)
			),
			this.customMaps(poolRefs(record)),
			this.services.tournamentNotices.list(record.id),
			canManage ? this.services.tournamentReports.openCount(record.id) : okAsync(0),
			this.hostOf(record)
		]).map(([participantRecords, { matches, replays, live }, custom, posts, openReports, host]) => {
			const participants = participantRecords
				.map((participant) => toParticipant(participant, record))
				.sort((a, b) => (a.seed ?? 9999) - (b.seed ?? 9999));
			const registered = participants.filter((p) => p.status !== 'withdrawn');
			return {
				tournament: {
					...this.view(record, registered.filter((p) => p.status === 'registered').length, custom),
					liveCount: live
				},
				participants: registered,
				matches,
				replays,
				posts,
				openReports,
				canManage,
				host,
				standings:
					record.format === 'round_robin'
						? standings(
								registered.map((p) => p.id),
								matches
							)
						: []
			};
		});
	}

	/** Matches with a started tournament game in progress. */
	private playingMatches(tournamentId: string): Task<Set<string>> {
		return fromPb(
			this.pb.collection('tournament_claims').getFullList<{ match: string }>({
				filter: this.pb.filter('tournament = {:tournamentId} && status = "playing"', {
					tournamentId
				}),
				fields: 'match'
			}),
			'Could not load the tournament games'
		).map((rows) => new Set(rows.map((row) => row.match)));
	}

	/** Tournaments by id for other services (cards, popups); drafts included. */
	summaries(ids: string[]): Task<Tournament[]> {
		const unique = [...new Set(ids)];
		if (unique.length === 0) {
			return okAsync([]);
		}

		return fromPb(
			this.tournaments.getFullList<TournamentRecord>({
				filter: unique.map((id) => this.pb.filter('id = {:id}', { id })).join(' || ')
			}),
			'Could not load tournaments'
		).andThen((records) => this.withCounts(records));
	}

	/** Completed tournaments, last finished first, with when they finished (hall of fame). */
	finished(): Task<{ tournament: Tournament; finishedAt: string }[]> {
		return fromPb(
			this.tournaments.getFullList<TournamentRecord & { updated: string; completedAt: string }>({
				filter: 'status = "completed"',
				sort: '-updated'
			}),
			'Could not load tournaments'
		).andThen((records) => {
			// Finished before `completedAt` existed: their last edit is the best guess.
			const finishedAt = (record: (typeof records)[number]) => record.completedAt || record.updated;
			const sorted = [...records].sort(
				(a, b) => parseDate(finishedAt(b)) - parseDate(finishedAt(a))
			);
			return this.withCounts(sorted).map((tournaments) =>
				tournaments.map((tournament, index) => ({
					tournament,
					finishedAt: finishedAt(sorted[index])
				}))
			);
		});
	}

	/** Staff: the last moment to play each round (`roundKey` → ISO date; null clears it). */
	setRoundDeadlines(id: string, rounds: Record<string, string | null>): Task<TournamentDetail> {
		return this.record(id, true).andThen((record) => {
			const next = { ...roundDeadlinesOf(record) };
			for (const [key, value] of Object.entries(rounds)) {
				if (value) {
					next[key] = value;
				} else {
					delete next[key];
				}
			}

			const before = roundDeadlinesOf(record);
			const changed = Object.fromEntries(
				Object.entries(rounds).filter(([key, value]) => (before[key] ?? null) !== (value ?? null))
			);
			return fromPb(
				this.tournaments.update<TournamentRecord>(record.id, { roundDeadlines: next }),
				'Could not save the deadlines'
			)
				.andThen((updated) => this.clearOverdueNotices(updated.id).map(() => updated))
				.andThen((updated) =>
					Object.keys(changed).length > 0 && updated.status === 'in_progress'
						? this.services.tournamentNotices
								.auto(updated, 'deadlines', { rounds: changed })
								.map(() => updated)
						: okAsync(updated)
				)
				.andThen((updated) => this.detail(updated));
		});
	}

	/** Staff: a deadline for one match only (null falls back to its round's). */
	setMatchDeadline(id: string, matchId: string, deadline: string | null): Task<TournamentDetail> {
		return this.record(id, true).andThen((record) =>
			this.ownMatch(record.id, matchId)
				.andThen(() =>
					fromPb(
						this.matches.update(matchId, { deadline: deadline ?? '', overdueNotifiedAt: '' }),
						'Could not save the deadline'
					)
				)
				.andThen(() => this.detail(record))
				.andThen((detail) => {
					const match = detail.matches.find((m) => m.id === matchId);
					return match && match.status !== 'completed'
						? this.services.tournamentNotices.matchDeadline(record, match).map(() => detail)
						: okAsync(detail);
				})
		);
	}

	/** The match must belong to this tournament (a host only runs their own). */
	private ownMatch(tournamentId: string, matchId: string): Task<void> {
		return pbMaybe(
			this.matches.getOne<{ id: string; tournament: string }>(matchId, {
				fields: 'id,tournament'
			}),
			'Could not load the match'
		).andThen((match) =>
			match?.tournament === tournamentId
				? okAsync(undefined)
				: errAsync(notFound('Match not found.'))
		);
	}

	/** A new deadline may be later: staff get a fresh overdue notice when it passes again. */
	private clearOverdueNotices(tournamentId: string): Task<void> {
		return fromPb(
			this.matches.getFullList<{ id: string }>({
				filter: this.pb.filter('tournament = {:tournamentId} && overdueNotifiedAt != ""', {
					tournamentId
				}),
				fields: 'id'
			}),
			'Could not load the matches'
		)
			.andThen((rows) =>
				inParallel(rows, 5, (row) =>
					fromPb(this.matches.update(row.id, { overdueNotifiedAt: '' }), 'Could not save the match')
				)
			)
			.map(() => undefined);
	}

	/** The tournament games whose match has a replay file; hidden matches stay out. */
	private replaysOf(matches: TournamentMatch[]): Task<TournamentReplay[]> {
		const ids = [...new Set(matches.flatMap((match) => match.games.map((game) => game.lobbyId)))];
		if (ids.length === 0) {
			return okAsync([]);
		}

		return inParallel(chunk(ids, 50), 3, (slice) =>
			fromPb(
				this.pb
					.collection('lobbies')
					.getFullList<{ id: string; map: string; replayDurationSeconds: number }>({
						filter: `hasReplay = true && isHidden = false && (${slice
							.map((id) => this.pb.filter('id = {:id}', { id }))
							.join(' || ')})`,
						fields: 'id,map,replayDurationSeconds'
					}),
				'Could not load the replays'
			)
		).map((pages) =>
			pages.flat().map((lobby) => ({
				lobbyId: lobby.id,
				map: lobby.map || '',
				durationSeconds: lobby.replayDurationSeconds || null
			}))
		);
	}

	/**
	 * Adds each player's highest current ELO. Until the bracket starts it also shows the current
	 * 1v1 ELO (seeding stores it, but signed-up players have none yet). A failed lookup keeps the
	 * stored ratings.
	 */
	private withLiveRatings(
		record: TournamentRecord,
		participants: ParticipantRecord[]
	): Task<ParticipantRecord[]> {
		if (participants.length === 0) {
			return okAsync(participants);
		}

		const open = OPEN.includes(record.status);
		return this.services.ratings
			.many(participants.map((p) => p.steamId))
			.map((ratings) => {
				const bySteam = new Map(ratings.map((rating) => [rating.steamId, rating.elo]));
				return participants.map((p) => {
					const elo = bySteam.get(p.steamId);
					return {
						...p,
						rating: (open && elo && oneVsOneElo(elo)) || p.rating,
						highestRating: elo ? highestElo(elo) : null
					};
				});
			})
			.orElse(() => okAsync(participants));
	}

	private validate(input: Partial<TournamentInput>): Task<void> {
		return ensure(
			input.name === undefined || input.name.trim().length > 0,
			badRequest('Give the tournament a name.')
		)
			.andThen(() =>
				ensure(
					input.maxParticipants == null || input.maxParticipants >= 2,
					badRequest('A tournament needs at least 2 players.')
				)
			)
			.asyncAndThen(() => (input.mapPool ? this.validateMaps(input.mapPool) : okAsync(undefined)));
	}

	/** Every reference is a stock, workshop or existing custom map. */
	private validateMaps(refs: string[]): Task<void> {
		const known = (ref: string) => isBuiltInMap(ref) || Boolean(workshopMap(ref));
		const unknown = refs.filter((ref) => !known(ref) && !customMapId(ref));
		return ensure(unknown.length === 0, badRequest('Unknown map in the map pool.'))
			.asyncAndThen(() => this.customMaps(refs))
			.andThen((custom) =>
				refs.every((ref) => known(ref) || custom.has(ref))
					? okAsync(undefined)
					: errAsync(badRequest('Unknown map in the map pool.'))
			);
	}

	private uniqueSlug(name: string): Task<string> {
		// Paths next to `/tournaments/[slug]` (pages and `/api/v1/tournaments/...`) are taken.
		const base = RESERVED_SLUGS.includes(slugify(name))
			? `${slugify(name)}-tournament`
			: slugify(name);
		return pbMaybe(
			this.tournaments.getFirstListItem(this.pb.filter('slug = {:slug}', { slug: base }), {
				fields: 'id'
			})
		).map((taken) => (taken ? `${base}-${Date.now().toString(36).slice(-5)}` : base));
	}

	create(input: TournamentInput, images: TournamentImages, staffId: string): Task<Tournament> {
		return imageFields(images)
			.asyncAndThen((files) =>
				this.validate(input)
					.andThen(() => this.uniqueSlug(input.name))
					.map((slug) => ({ slug, files }))
			)
			.andThen(({ slug, files }) =>
				fromPb(
					this.tournaments.create<TournamentRecord>({
						...input,
						...files,
						name: input.name.trim(),
						finalsBestOf: input.finalsBestOf ?? 0,
						maxParticipants: input.maxParticipants ?? 0,
						registrationClosesAt: input.registrationClosesAt ?? '',
						startsAt: input.startsAt ?? '',
						medal: input.medal ?? '',
						streamUrl: input.streamUrl ?? '',
						slug,
						status: 'draft',
						createdBy: staffId
					}),
					'Could not create the tournament'
				)
			)
			.andThen((record) => this.withCounts([record]).map(([tournament]) => tournament));
	}

	/** Settings can change until the bracket exists; after that only the texts and cancelling. */
	update(id: string, input: TournamentUpdate, images: TournamentImages = {}): Task<Tournament> {
		const files = imageFields(images);
		if (files.isErr()) {
			return errAsync(files.error);
		}

		return this.record(id, true)
			.andThen((record) => {
				const started = !['draft', ...OPEN].includes(record.status);
				const structural =
					input.format !== undefined ||
					input.bestOf !== undefined ||
					input.finalsBestOf !== undefined ||
					input.grandFinalReset !== undefined;
				return ensure(
					!started || !structural,
					badRequest('The format cannot change after the tournament started.')
				)
					.andThen(() =>
						ensure(
							!input.status || input.status === 'cancelled' || !started,
							badRequest('The tournament already started.')
						)
					)
					.andThen(() =>
						ensure(
							record.status !== 'completed' || Object.keys(input).every((key) => key === 'medal'),
							badRequest('The tournament is already finished.')
						)
					)
					.asyncAndThen(() => this.validate(input))
					.map(() => record);
			})
			.andThen((record) => {
				const data: Record<string, unknown> = { ...input, ...files.value };
				if (input.name !== undefined) {
					data.name = input.name.trim();
				}

				for (const field of ['finalsBestOf', 'maxParticipants'] as const) {
					if (field in input) {
						data[field] = input[field] ?? 0;
					}
				}

				if ('medal' in input) {
					data.medal = input.medal ?? '';
				}

				if ('streamUrl' in input) {
					data.streamUrl = input.streamUrl ?? '';
				}

				for (const field of ['registrationClosesAt', 'startsAt'] as const) {
					if (field in input) {
						data[field] = input[field] ?? '';
					}
				}

				// Changed rules have to be accepted again.
				if ('rules' in input && (input.rules ?? '').trim() !== (record.rules ?? '').trim()) {
					data.rulesUpdatedAt = pbDate(new Date());
				}

				// A new start time gets a new "starts soon" reminder.
				if ('startsAt' in input && (input.startsAt ?? '') !== (record.startsAt ?? '')) {
					data.reminderSentAt = '';
				}

				// A new closing time closes registration again when it passes.
				const closesAt = (value: string | null | undefined) => (value ? parseDate(value) || 0 : 0);
				if (
					'registrationClosesAt' in input &&
					closesAt(input.registrationClosesAt) !== closesAt(record.registrationClosesAt)
				) {
					data.autoClosedAt = '';
				}

				// Reopening after the closing time passed: without a new closing time nobody could
				// sign up (and the job would close it again), so it stays open until staff close it.
				if (
					input.status === 'registration' &&
					record.status === 'seeding' &&
					!('registrationClosesAt' in input) &&
					closesAt(record.registrationClosesAt) > 0 &&
					closesAt(record.registrationClosesAt) <= Date.now()
				) {
					data.registrationClosesAt = '';
					data.autoClosedAt = '';
				}

				return fromPb(
					this.tournaments.update<TournamentRecord>(record.id, data),
					'Could not save the tournament'
				).andThen((updated) => this.announceChanges(record, updated).map(() => updated));
			})
			.andThen((record) =>
				record.status === 'cancelled'
					? this.services.hiddenMatches.unhideTournament(record.id).map(() => record)
					: okAsync(record)
			)
			.andThen((record) => this.withCounts([record]).map(([tournament]) => tournament));
	}

	/** Updates for the participants: cancelled, new rules, a new start time. */
	private announceChanges(before: TournamentRecord, after: TournamentRecord): Task<void> {
		const notices = this.services.tournamentNotices;
		if (before.status === 'draft' || after.status === 'draft') {
			return okAsync(undefined);
		}

		if (after.status === 'cancelled' && before.status !== 'cancelled') {
			return notices.auto(after, 'cancelled', {}, true);
		}

		const rules = (before.rules ?? '').trim() !== (after.rules ?? '').trim();
		const schedule =
			OPEN.includes(after.status) && (before.startsAt ?? '') !== (after.startsAt ?? '');
		return (rules ? notices.auto(after, 'rules', {}, true) : okAsync(undefined)).andThen(() =>
			schedule
				? notices.auto(after, 'schedule', { startsAt: orNull(after.startsAt) }, true)
				: okAsync(undefined)
		);
	}

	/** Staff: a post on the Updates tab (not on a draft: nobody signed up yet). */
	createPost(id: string, input: TournamentPostInput, staffId: string): Task<TournamentPost> {
		return this.record(id, true).andThen((record) =>
			ensure(
				record.status !== 'draft',
				badRequest('Open registration before posting updates.')
			).asyncAndThen(() => this.services.tournamentNotices.create(record, input, staffId))
		);
	}

	updatePost(id: string, postId: string, input: TournamentPostInput): Task<TournamentPost> {
		return this.record(id, true).andThen((record) =>
			this.services.tournamentNotices.update(record.id, postId, input)
		);
	}

	deletePost(id: string, postId: string): Task<void> {
		return this.record(id, true).andThen((record) =>
			this.services.tournamentNotices.remove(record.id, postId)
		);
	}

	/** A participant reports a problem with their match to staff. */
	report(user: AuthUserPublic, id: string, matchId: string, report: TournamentReport): Task<void> {
		return this.record(id, false).andThen((record) =>
			this.services.tournamentReports.create(user, record.id, matchId, report).map(() => undefined)
		);
	}

	/** Signs a user up with one of their linked Steam accounts that has played a game. */
	register(
		id: string,
		user: AuthUserPublic,
		steamId: string,
		acceptRules: boolean
	): Task<TournamentDetail> {
		return this.record(id, false).andThen((record) =>
			ensure(
				record.status === 'registration',
				badRequest('Registration for this tournament is closed.')
			)
				.andThen(() =>
					ensure(
						acceptRules || !(record.rules ?? '').trim(),
						badRequest('Accept the rules to sign up.')
					)
				)
				.andThen(() =>
					ensure(
						!record.registrationClosesAt || parseDate(record.registrationClosesAt) > Date.now(),
						badRequest('Registration for this tournament is closed.')
					)
				)
				.andThen(() =>
					ensure(
						meSteamIds(user).includes(steamId),
						badRequest('Link this Steam account to your account first.')
					)
				)
				.asyncAndThen(() => this.participantRecords(record.id))
				.andThen((existing) => {
					const registered = existing.filter((p) => p.status === 'registered');
					if (existing.some((p) => p.user === user.id && p.status !== 'withdrawn')) {
						return errAsync(conflict('You are already signed up.'));
					}

					if (record.maxParticipants && registered.length >= record.maxParticipants) {
						return errAsync(conflict('This tournament is full.'));
					}

					return this.player(steamId).andThen((player) => {
						const data = {
							tournament: record.id,
							user: user.id,
							steamId,
							profileId: player.profile_id,
							alias: player.alias,
							status: 'registered',
							seed: 0,
							rating: 0,
							...((record.rules ?? '').trim() ? { rulesAcceptedAt: pbDate(new Date()) } : {})
						};
						const previous = existing.find((p) => p.user === user.id);
						return previous
							? fromPb(this.participants.update(previous.id, data), 'Could not sign up')
							: fromPb(this.participants.create(data), 'Could not sign up');
					});
				})
				.andThen(() =>
					this.services.tournamentNotices.registered(
						{ ...record, startsAt: orNull(record.startsAt) },
						user.id
					)
				)
				.andThen(() => this.detail(record))
		);
	}

	private player(steamId: string): Task<{ profile_id: number; alias: string }> {
		return pbMaybe(
			this.pb.collection('players').getFirstListItem<{
				profile_id: number;
				alias: string;
			}>(this.pb.filter('steam_id = {:steamId}', { steamId }), { fields: 'profile_id,alias' }),
			'Could not load the player'
		).andThen((player) =>
			player?.profile_id
				? okAsync(player)
				: errAsync(
						badRequest(
							'We have not seen a game of this Steam account yet. Play a match with the app first.'
						)
					)
		);
	}

	/** A participant accepts the current rules (again, after they changed). */
	acceptRules(id: string, user: AuthUserPublic): Task<TournamentDetail> {
		return this.record(id, false).andThen((record) =>
			this.participantRecords(record.id)
				.andThen((existing) => {
					const mine = existing.find((p) => p.user === user.id && p.status !== 'withdrawn');
					return mine
						? fromPb(
								this.participants.update(mine.id, { rulesAcceptedAt: pbDate(new Date()) }),
								'Could not save'
							)
						: errAsync(notFound('You are not signed up.'));
				})
				.andThen(() => this.detail(record))
		);
	}

	/** Staff: put a match in the spotlight (null clears it). */
	feature(id: string, matchId: string | null): Task<TournamentDetail> {
		return this.record(id, true).andThen((record) =>
			ensure(
				record.status === 'in_progress',
				badRequest('Only a running tournament has a featured match.')
			)
				.asyncAndThen(() =>
					matchId
						? pbMaybe(
								this.matches.getFirstListItem<{ id: string }>(
									this.pb.filter('id = {:matchId} && tournament = {:tournamentId}', {
										matchId,
										tournamentId: record.id
									}),
									{ fields: 'id' }
								),
								'Could not load the match'
							).andThen((match) =>
								match ? okAsync(undefined) : errAsync(notFound('Match not found.'))
							)
						: okAsync(undefined)
				)
				.andThen(() =>
					fromPb(
						this.tournaments.update<TournamentRecord>(record.id, { featuredMatch: matchId ?? '' }),
						'Could not save the tournament'
					)
				)
				.andThen((updated) => this.detail(updated))
		);
	}

	withdraw(id: string, userId: string): Task<TournamentDetail> {
		return this.record(id, false).andThen((record) =>
			ensure(OPEN.includes(record.status), badRequest('The tournament already started.'))
				.asyncAndThen(() => this.participantRecords(record.id))
				.andThen((existing) => {
					const mine = existing.find((p) => p.user === userId);
					return mine
						? fromPb(this.participants.delete(mine.id), 'Could not withdraw')
						: errAsync(notFound('You are not signed up.'));
				})
				.andThen(() => this.detail(record))
		);
	}

	/** Closes registration and seeds everyone by 1v1 ELO (unrated players last, by sign-up). */
	seed(id: string): Task<TournamentDetail> {
		return this.record(id, true).andThen((record) =>
			ensure(OPEN.includes(record.status), badRequest('The tournament already started.'))
				.asyncAndThen(() => this.participantRecords(record.id))
				.andThen((existing) => {
					const registered = existing.filter((p) => p.status === 'registered');
					return inParallel(registered, 5, (participant) =>
						this.services.ratings
							.get(participant.steamId)
							.map((rating) => oneVsOneElo(rating.elo))
							.orElse(() => okAsync(null))
							.map((rating) => ({ participant, rating }))
					);
				})
				.andThen((rated) => {
					const order = [...rated].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
					return inParallel(order, 5, ({ participant, rating }) =>
						fromPb(
							this.participants.update(participant.id, {
								rating: rating ?? 0,
								seed: order.findIndex((row) => row.participant.id === participant.id) + 1
							}),
							'Could not save the seeding'
						)
					);
				})
				.andThen(() =>
					fromPb(
						this.tournaments.update<TournamentRecord>(record.id, { status: 'seeding' }),
						'Could not save the seeding'
					)
				)
				.andThen((updated) =>
					// Seeding again later is no news.
					record.status === 'registration'
						? this.services.tournamentNotices.auto(updated, 'seeded').map(() => updated)
						: okAsync(updated)
				)
				.andThen((updated) => this.detail(updated))
		);
	}

	/**
	 * Job: closes registration of tournaments past `registrationClosesAt` and seeds them, once
	 * per closing time (`autoClosedAt`; staff may reopen registration afterwards).
	 */
	closeDue(): Task<number> {
		return fromPb(
			this.tournaments.getList<TournamentRecord>(1, 50, {
				filter: this.pb.filter(
					'status = "registration" && registrationClosesAt != "" && ' +
						'registrationClosesAt <= {:now} && autoClosedAt = ""',
					{ now: pbDate(new Date()) }
				),
				skipTotal: true
			}),
			'Could not load tournaments'
		).andThen(({ items }) =>
			// A failed seed (PocketBase or ratings hiccup) is not stamped, so the next run retries.
			sequence(items, (record) =>
				this.seed(record.id)
					.andThen((detail) =>
						fromPb(
							this.tournaments.update(record.id, { autoClosedAt: pbDate(new Date()) }),
							'Could not save the tournament'
						).andThen(() =>
							this.services.tournamentNotices.registrationClosed(
								record,
								detail.participants.filter((p) => p.status === 'registered').length
							)
						)
					)
					.map(() => true)
					.orElse((error) => {
						console.error('[tournaments] could not close registration', record.id, error);
						return okAsync(false);
					})
			).map((done) => done.filter(Boolean).length)
		);
	}

	/** `order`: every registered participant id, top seed first. */
	setSeeds(id: string, order: string[]): Task<TournamentDetail> {
		return this.record(id, true).andThen((record) =>
			ensure(OPEN.includes(record.status), badRequest('The tournament already started.'))
				.asyncAndThen(() => this.participantRecords(record.id))
				.andThen((existing) => {
					const registered = new Set(
						existing.filter((p) => p.status === 'registered').map((p) => p.id)
					);
					const valid =
						order.length === registered.size &&
						new Set(order).size === order.length &&
						order.every((participantId) => registered.has(participantId));
					return ensure(valid, badRequest('The seeding does not match the players.'))
						.asyncAndThen(() =>
							inParallel(order, 5, (participantId) =>
								fromPb(
									this.participants.update(participantId, {
										seed: order.indexOf(participantId) + 1
									}),
									'Could not save the seeding'
								)
							)
						)
						.andThen(() =>
							fromPb(
								this.tournaments.update<TournamentRecord>(record.id, { status: 'seeding' }),
								'Could not save the seeding'
							)
						);
				})
				.andThen((updated) => this.detail(updated))
		);
	}

	/** Builds the bracket from the seeding (removing any half-built one) and starts the tournament. */
	start(id: string): Task<TournamentDetail> {
		return this.record(id, true).andThen((record) =>
			ensure(record.status === 'seeding', badRequest('Seed the players first.'))
				.asyncAndThen(() => this.participantRecords(record.id))
				.andThen((existing) => {
					const seeded = existing
						.filter((p) => p.status === 'registered')
						.sort((a, b) => (a.seed || 9999) - (b.seed || 9999))
						.map((p) => p.id);
					return ensure(seeded.length >= 2, badRequest('A tournament needs at least 2 players.'))
						.asyncAndThen(() => this.clearMatches(record.id))
						.andThen(() => this.createBracket(record, seeded))
						.map(() => seeded.length);
				})
				.andThen((players) =>
					fromPb(
						this.tournaments.update<TournamentRecord>(record.id, {
							status: 'in_progress',
							startsAt: record.startsAt || pbDate(new Date())
						}),
						'Could not start the tournament'
					).andThen((updated) =>
						this.services.tournamentNotices
							.skipReadyNotices(updated.id)
							.andThen(() => this.services.tournamentNotices.auto(updated, 'started', { players }))
							.map(() => updated)
					)
				)
				.andThen((updated) => this.detail(updated))
		);
	}

	private clearMatches(tournamentId: string): Task<void> {
		return this.matchList(tournamentId)
			.andThen((matches) =>
				inParallel(matches, 5, (match) =>
					fromPb(this.matches.delete(match.id), 'Could not reset the bracket')
				)
			)
			.map(() => undefined);
	}

	/** Two passes: create every match, then link winners and losers to the next match ids. */
	private createBracket(record: TournamentRecord, seeded: string[]): Task<void> {
		const specs = buildBracket(record.format, seeded, {
			bestOf: record.bestOf || 1,
			finalsBestOf: record.finalsBestOf || null,
			reset: Boolean(record.grandFinalReset)
		});
		return inParallel(specs, 5, (spec) =>
			fromPb(
				this.matches.create<MatchRecord>({
					tournament: record.id,
					bracket: spec.bracket,
					round: spec.round,
					position: spec.position,
					bestOf: spec.bestOf,
					playerA: spec.playerA ?? '',
					playerB: spec.playerB ?? '',
					status: spec.status,
					bye: spec.bye,
					winsA: 0,
					winsB: 0,
					games: []
				}),
				'Could not create the bracket'
			).map((created) => [spec.key, created.id] as const)
		)
			.andThen((pairs) => {
				const ids = new Map(pairs);
				const linked = specs.filter((spec) => spec.next || spec.loserNext);
				return inParallel(linked, 5, (spec) =>
					fromPb(
						this.matches.update(ids.get(spec.key)!, {
							nextMatch: spec.next ? ids.get(spec.next.key) : '',
							nextSlot: spec.next?.slot ?? '',
							loserNextMatch: spec.loserNext ? ids.get(spec.loserNext.key) : '',
							loserNextSlot: spec.loserNext?.slot ?? ''
						}),
						'Could not create the bracket'
					)
				);
			})
			.andThen(() => this.matchList(record.id))
			.andThen((matches) => this.saveMatches(settleStart(matches, pbDate(new Date()))))
			.map(() => undefined);
	}

	private saveMatches(changed: TournamentMatch[]): Task<TournamentMatch[]> {
		return inParallel(changed, 5, (match) =>
			fromPb(this.matches.update(match.id, matchFields(match)), 'Could not save the match')
		).map(() => changed);
	}

	/** Players who lose every match they reach. */
	private outPlayers(tournamentId: string): Task<Set<string>> {
		return this.participantRecords(tournamentId).map(
			(rows) =>
				new Set(
					rows.filter((p) => p.status === 'disqualified').map((participant) => participant.id)
				)
		);
	}

	/**
	 * Staff: a score (finishes the match once someone has enough wins), a walkover, or
	 * `reset` to clear it. A finished match can only change while the next matches are unplayed.
	 */
	setMatchResult(
		id: string,
		matchId: string,
		result: TournamentMatchResult
	): Task<TournamentMatch[]> {
		return this.record(id, true).andThen((record) =>
			ensure(record.status === 'in_progress', badRequest('The tournament is not running.'))
				.asyncAndThen(() =>
					ResultAsync.combine([this.matchList(record.id), this.outPlayers(record.id)])
				)
				.andThen(([matches, out]) => {
					const match = matches.find((m) => m.id === matchId);
					if (!match || match.bye || !match.playerA || !match.playerB) {
						return errAsync(notFound('Match not found.'));
					}

					const now = pbDate(new Date());
					const reopened = reopenMatch(matches, matchId, now);
					if (!reopened) {
						return errAsync(badRequest('A later match was already played. Reset that one first.'));
					}

					const merged = merge(matches, reopened);
					const current = merged.find((m) => m.id === matchId)!;
					const scored = score(current, result);
					if (!scored) {
						return errAsync(badRequest('That score is not possible in this match.'));
					}

					const afterScore = merge(merged, [scored.match]);
					const resolved = scored.winner
						? resolveMatch(afterScore, matchId, scored.winner, now, out)
						: [];
					const changed = merge(
						[...reopened.filter((m) => m.id !== matchId), scored.match],
						resolved
					);
					return this.saveMatches(changed)
						.andThen(() => this.services.tournamentNotices.staffResult(record, scored.match))
						.andThen(() => this.finishIfDone(record, merge(afterScore, resolved)));
				})
		);
	}

	/** Staff: a disqualified player forfeits their open matches and every later one. */
	disqualify(id: string, participantId: string): Task<TournamentDetail> {
		return this.record(id, true).andThen((record) =>
			pbMaybe(
				this.participants.getOne<{ id: string; tournament: string }>(participantId, {
					fields: 'id,tournament'
				}),
				'Could not load the player'
			)
				.andThen((participant) =>
					participant?.tournament === record.id
						? okAsync(participant)
						: errAsync(notFound('Player not found.'))
				)
				.andThen(() =>
					fromPb(
						this.participants.update(participantId, { status: 'disqualified' }),
						'Could not disqualify the player'
					)
				)
				.andThen(() =>
					record.status === 'in_progress'
						? ResultAsync.combine([this.matchList(record.id), this.outPlayers(record.id)]).andThen(
								([matches, out]) => {
									const changed = forfeitAll(matches, pbDate(new Date()), out);
									return this.saveMatches(changed).andThen(() =>
										this.finishIfDone(record, merge(matches, changed))
									);
								}
							)
						: okAsync([])
				)
				.andThen(() => this.services.tournamentNotices.disqualified(record, participantId))
				.andThen(() => this.detail(record))
		);
	}

	/** Once every match has a result: the champion, everyone's place and the status. */
	private finishIfDone(
		record: TournamentRecord,
		matches: TournamentMatch[]
	): Task<TournamentMatch[]> {
		if (!isFinished(matches)) {
			return okAsync(matches);
		}

		return this.participantRecords(record.id).andThen((rows) => {
			const ids = rows.filter((p) => p.status !== 'withdrawn').map((p) => p.id);
			const seeded = rows
				.filter((p) => p.status !== 'withdrawn')
				.sort((a, b) => (a.seed || 9999) - (b.seed || 9999))
				.map((p) => p.id);
			const table = standings(seeded, matches);
			const places = placements(record.format, ids, matches, table);
			const winner = champion(record.format, matches, table) ?? '';
			return (
				inParallel([...places], 5, ([participantId, placement]) =>
					fromPb(
						this.participants.update(participantId, { placement }),
						'Could not save the places'
					)
				)
					.andThen(() =>
						fromPb(
							this.tournaments.update(record.id, {
								status: 'completed',
								winner,
								completedAt: pbDate(new Date())
							}),
							'Could not finish the tournament'
						)
					)
					// No more spoilers: its games show up in the public lists and the replays tab.
					.andThen(() => this.services.hiddenMatches.unhideTournament(record.id))
					.andThen(() =>
						this.services.tournamentNotices.finished(
							record,
							places,
							rows.find((p) => p.id === winner)?.alias ?? null
						)
					)
					.map(() => matches)
			);
		});
	}

	/**
	 * The `tournament-sync` job. A game counts once a started tournament game (a claim from
	 * "Start tournament game" in the app) has a Relic result; other games between the two
	 * players do not. Also drops claims that can no longer count.
	 */
	sync(): Task<{ processed: number; more: boolean }> {
		return this.dropStaleClaims().andThen(() =>
			fromPb(
				this.pb.collection('tournament_claims').getList<ClaimRecord>(1, SYNC_BATCH, {
					filter:
						'status = "playing" && sessionId > 0 && match.status = "ready" && ' +
						'match.manual = false && tournament.status = "in_progress"',
					sort: 'created',
					skipTotal: true
				}),
				'Could not load tournament games'
			).andThen(({ items }) => {
				const tournamentIds = [...new Set(items.map((claim) => claim.tournament))];
				return sequence(tournamentIds, (tournamentId) =>
					this.syncTournament(
						tournamentId,
						items.filter((claim) => claim.tournament === tournamentId)
					)
				).map((counts) => ({ processed: counts.reduce((sum, n) => sum + n, 0), more: false }));
			})
		);
	}

	/**
	 * Armed claims expire unused; started ones end when their match got a result some other way
	 * (staff, a walkover) or their lobby never got a Relic result. A claim row is reused when the
	 * player arms again, so a started game's age is its last update (the claim), not `created`.
	 */
	private dropStaleClaims(): Task<void> {
		const filter = this.pb.filter(
			'(status = "armed" && armedAt < {:armed}) || (status = "playing" && ' +
				'(match.status = "completed" || match.manual = true || updated < {:playing}))',
			{
				armed: pbDate(new Date(Date.now() - CLAIM_ARMED_MS)),
				playing: pbDate(new Date(Date.now() - CLAIM_PLAYING_MS))
			}
		);
		return fromPb(
			this.pb
				.collection('tournament_claims')
				.getList<{ id: string }>(1, 100, { filter, fields: 'id', skipTotal: true }),
			'Could not load tournament games'
		)
			.andThen(({ items }) =>
				inParallel(items, 5, (claim) =>
					fromPb(
						this.pb.collection('tournament_claims').update(claim.id, { status: 'void' }),
						'Could not update the tournament game'
					)
				)
			)
			.map(() => undefined);
	}

	private syncTournament(tournamentId: string, claims: ClaimRecord[]): Task<number> {
		return ResultAsync.combine([
			this.participantRecords(tournamentId),
			this.matchList(tournamentId)
		]).andThen(([rows, matches]) => {
			const profiles = new Map(rows.map((p) => [p.id, p.profileId]));
			const used = new Set(matches.flatMap((m) => m.games.map((game) => game.lobbyId)));
			const byMatch = new Map<string, ClaimRecord[]>();
			for (const claim of claims) {
				byMatch.set(claim.match, [...(byMatch.get(claim.match) ?? []), claim]);
			}

			return sequence([...byMatch], ([matchId, matchClaims]) => {
				const match = matches.find((m) => m.id === matchId);
				if (!match) {
					return okAsync(0);
				}

				return this.findGames(match, matchClaims, profiles, used).andThen((found) =>
					found.length
						? this.addGames(
								tournamentId,
								match.id,
								found.map(({ game }) => game)
							)
								.andThen(() => this.markCounted(found))
								.map(() => found.length)
						: okAsync(0)
				);
			}).map((counts) => counts.reduce((sum, n) => sum + n, 0));
		});
	}

	/**
	 * The claimed lobbies of a match that have a Relic result, oldest first; `used` lobbies are
	 * skipped. A game only counts when both players have an index row and exactly one of them
	 * won: PocketBase stores an unknown outcome as 0, the same as a loss.
	 */
	private findGames(
		match: TournamentMatch,
		claims: ClaimRecord[],
		profiles: Map<string, number>,
		used: Set<string>
	): Task<{ claim: ClaimRecord; game: TournamentGame }[]> {
		const a = match.playerA ? profiles.get(match.playerA) : undefined;
		const b = match.playerB ? profiles.get(match.playerB) : undefined;
		if (!a || !b || claims.length === 0) {
			return okAsync([]);
		}

		const sessions = claims
			.map((claim) => this.pb.filter('session_id = {:session}', { session: claim.sessionId }))
			.join(' || ');
		return fromPb(
			this.pb.collection('lobby_player_index').getList<IndexGame>(1, 40, {
				filter: this.pb.filter(`(profile_id = {:a} || profile_id = {:b}) && (${sessions})`, {
					a,
					b
				}),
				sort: 'session_id',
				expand: 'lobby',
				fields: 'lobby,profile_id,outcome,session_id,expand.lobby.createdAt',
				skipTotal: true
			}),
			'Could not load tournament games'
		).map(({ items }) => {
			const byLobby = new Map<string, IndexGame[]>();
			for (const row of items) {
				byLobby.set(row.lobby, [...(byLobby.get(row.lobby) ?? []), row]);
			}

			const found: { claim: ClaimRecord; game: TournamentGame }[] = [];
			for (const [lobbyId, rows] of byLobby) {
				const rowA = rows.find((row) => row.profile_id === a);
				const rowB = rows.find((row) => row.profile_id === b);
				const claim = claims.find((c) => c.sessionId === rowA?.session_id);
				if (used.has(lobbyId) || !claim || !rowA || !rowB || rowA.outcome + rowB.outcome !== 1) {
					continue;
				}

				found.push({
					claim: { ...claim, lobby: lobbyId },
					game: {
						lobbyId,
						sessionId: rowA.session_id || null,
						winner: rowA.outcome === 1 ? 'A' : 'B',
						playedAt: parseDate(rowA.expand?.lobby?.createdAt ?? '') || Date.now()
					}
				});
			}

			return found;
		});
	}

	private markCounted(found: { claim: ClaimRecord }[]): Task<void> {
		return inParallel(found, 5, ({ claim }) =>
			fromPb(
				this.pb.collection('tournament_claims').update(claim.id, {
					status: 'counted',
					lobby: claim.lobby,
					processedAt: pbDate(new Date())
				}),
				'Could not update the tournament game'
			)
		).map(() => undefined);
	}

	/** Adds games to a match (reloading it first) and finishes it once a player has enough wins. */
	private addGames(tournamentId: string, matchId: string, games: TournamentGame[]): Task<void> {
		return this.record(tournamentId, true).andThen((record) =>
			ResultAsync.combine([this.matchList(tournamentId), this.outPlayers(tournamentId)]).andThen(
				([matches, out]) => {
					const match = matches.find((m) => m.id === matchId);
					if (!match || match.status !== 'ready' || match.manual) {
						return okAsync(undefined);
					}

					const needed = winsNeeded(match.bestOf);
					const updated = { ...match, games: [...match.games] };
					for (const game of games) {
						if (updated.winsA >= needed || updated.winsB >= needed) {
							break;
						}

						updated.games.push(game);
						if (game.winner === 'A') {
							updated.winsA++;
						} else {
							updated.winsB++;
						}
					}

					const winner: TournamentSlot | null =
						updated.winsA >= needed ? 'A' : updated.winsB >= needed ? 'B' : null;
					const afterScore = merge(matches, [updated]);
					const resolved = winner
						? resolveMatch(afterScore, matchId, winner, pbDate(new Date()), out)
						: [];
					return this.saveMatches(merge([updated], resolved))
						.andThen(() => this.finishIfDone(record, merge(afterScore, resolved)))
						.map(() => undefined);
				}
			)
		);
	}
}

/** `matches` with the `changed` ones swapped in (by id). */
function merge(matches: TournamentMatch[], changed: TournamentMatch[]): TournamentMatch[] {
	const byId = new Map(changed.map((match) => [match.id, match]));
	const result = matches.map((match) => byId.get(match.id) ?? match);
	for (const match of changed) {
		if (!matches.some((m) => m.id === match.id)) {
			result.push(match);
		}
	}

	return result;
}

/** A staff result applied to an (open) match; null when the score is impossible. */
function score(
	match: TournamentMatch,
	result: TournamentMatchResult
): { match: TournamentMatch; winner: TournamentSlot | null } | null {
	if ('reset' in result) {
		return {
			match: { ...match, winsA: 0, winsB: 0, games: [], manual: false, winner: null },
			winner: null
		};
	}

	if ('walkover' in result) {
		return { match: { ...match, manual: true }, winner: result.walkover };
	}

	const needed = winsNeeded(match.bestOf);
	const { winsA, winsB } = result;
	if (
		!Number.isInteger(winsA) ||
		!Number.isInteger(winsB) ||
		winsA < 0 ||
		winsB < 0 ||
		winsA > needed ||
		winsB > needed ||
		(winsA === needed && winsB === needed)
	) {
		return null;
	}

	return {
		match: { ...match, winsA, winsB, manual: true },
		winner: winsA === needed ? 'A' : winsB === needed ? 'B' : null
	};
}
