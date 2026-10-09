import type { TournamentMap } from './maps';

export const TOURNAMENT_FORMATS = ['single_elim', 'double_elim', 'round_robin'] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

export const TOURNAMENT_BEST_OF = [1, 3, 5, 7] as const;

export type TournamentStatus =
	| 'draft'
	| 'registration'
	| 'seeding'
	| 'in_progress'
	| 'completed'
	| 'cancelled';

export type TournamentBracket = 'winners' | 'losers' | 'grand_final' | 'round_robin';

export type TournamentSlot = 'A' | 'B';

export type TournamentScope = 'active' | 'upcoming' | 'past';

export type Tournament = {
	id: string;
	name: string;
	slug: string;
	description: string;
	rules: string;
	format: TournamentFormat;
	bestOf: number;
	finalsBestOf: number | null;
	grandFinalReset: boolean;
	status: TournamentStatus;
	registrationClosesAt: string | null;
	startsAt: string | null;
	maxParticipants: number | null;
	mapPool: TournamentMap[];
	winner: string | null;
	/** Champion's alias, only filled in the finished-tournaments list; null elsewhere. */
	champion: string | null;
	/** Wide header image, or null. */
	bannerUrl: string | null;
	/** Square logo, or null. */
	logoUrl: string | null;
	/** Champion medal from `shared-assets/medals` (e.g. `medal-042`), or null for the default. */
	medal: string | null;
	/** Last moment to play each round, keyed by `roundKey` (ISO dates). */
	roundDeadlines: Record<string, string>;
	/** When the rules last changed; players accept the rules again after this. */
	rulesUpdatedAt: string | null;
	/** Cast / stream of the tournament (https), or null. */
	streamUrl: string | null;
	/** Match staff put in the spotlight, or null. */
	featuredMatch: string | null;
	/** Matches being played right now (claimed games); 0 outside the active list and detail. */
	liveCount: number;
	participantCount: number;
	created: string;
};

/** Key of a bracket round in `roundDeadlines`, e.g. `winners:1` or `round_robin:3`. */
export const roundKey = (match: { bracket: TournamentBracket; round: number }) =>
	`${match.bracket}:${match.round}`;

export type TournamentParticipant = {
	id: string;
	user: string;
	steamId: string;
	profileId: number;
	alias: string;
	country: string;
	/** 1v1 ELO, used for seeding. */
	rating: number | null;
	/** Highest current ELO over every ladder; null when the lookup failed or the player is unrated. */
	highestRating: number | null;
	seed: number | null;
	status: 'registered' | 'withdrawn' | 'disqualified';
	placement: number | null;
	/** Accepted the current rules (always true when the tournament has none). */
	rulesAccepted: boolean;
};

/** One played game of a match, taken from a finished lobby or set by staff. */
export type TournamentGame = {
	lobbyId: string;
	sessionId: number | null;
	winner: TournamentSlot;
	playedAt: number;
};

export type TournamentMatch = {
	id: string;
	bracket: TournamentBracket;
	round: number;
	position: number;
	bestOf: number;
	playerA: string | null;
	playerB: string | null;
	winsA: number;
	winsB: number;
	winner: string | null;
	status: 'pending' | 'ready' | 'completed';
	readyAt: string | null;
	nextMatch: string | null;
	nextSlot: TournamentSlot | null;
	loserNextMatch: string | null;
	loserNextSlot: TournamentSlot | null;
	games: TournamentGame[];
	manual: boolean;
	bye: boolean;
	/** Last moment to play: the staff override, else the round's deadline. */
	deadline: string | null;
	/** Staff override for this match only. */
	deadlineOverride: string | null;
	/** A started tournament game of this match is being played right now. */
	playing: boolean;
	/** Time both players agreed on (or staff set), ISO, or null. */
	scheduledAt: string | null;
};

/** A started tournament game ("Start tournament game" in the app). */
export type TournamentClaim = {
	status: 'armed' | 'playing';
	/** Until when the next lobby with the opponent counts (armed only). */
	expiresAt: string | null;
};

/** What the app needs to recognise the tournament lobby after arming. */
export type TournamentArm = {
	opponentProfileId: number;
	opponentSteamId: string;
	expiresAt: string;
};

/** An open match of the signed-in player (dashboard panel, deadline warnings). */
export type MyTournamentMatch = {
	tournament: Pick<Tournament, 'id' | 'name' | 'slug' | 'format' | 'logoUrl' | 'medal'>;
	match: TournamentMatch;
	/** Rounds in the match's bracket, for `roundLabel`. */
	rounds: number;
	me: TournamentParticipant;
	mySlot: TournamentSlot;
	opponent: TournamentParticipant | null;
	claim: TournamentClaim | null;
	/** Replays of the games played so far; the players can open them while they are hidden. */
	replays: TournamentReplay[];
	/** Latest time proposal of this match (pending, or the accepted one), or null. */
	schedule: TournamentScheduleProposal | null;
	/** The player's own problem reports about this match, newest first. */
	reports: MyTournamentReport[];
};

export const TOURNAMENT_SCHEDULE_MAX_TIMES = 3;

/** Times one player proposed for a match; the opponent accepts one or proposes others. */
export type TournamentScheduleProposal = {
	id: string;
	match: string;
	/** Participant id of the player who proposed. */
	proposedBy: string;
	/** ISO times, earliest first. */
	times: string[];
	status: 'pending' | 'accepted' | 'declined' | 'superseded';
	acceptedTime: string | null;
	created: string;
};

export type TournamentResultPlayer = {
	slot: TournamentSlot;
	alias: string;
	steamId: string;
	profileId: number;
	raceId: number | null;
	outcome: number | null;
	oldRating: number | null;
	newRating: number | null;
};

/** A processed tournament game the player has not seen yet (result popup). */
export type TournamentGameResult = {
	lobbyId: string;
	tournament: Pick<Tournament, 'id' | 'name' | 'slug' | 'format' | 'logoUrl' | 'medal'>;
	match: Pick<
		TournamentMatch,
		'id' | 'bracket' | 'round' | 'bestOf' | 'winsA' | 'winsB' | 'status'
	>;
	rounds: number;
	mySlot: TournamentSlot;
	/** 1-based game number within the match. */
	gameNumber: number;
	won: boolean;
	/** The match is decided and the player won it. */
	wonMatch: boolean;
	/** The player won the whole tournament with this game. */
	wonTournament: boolean;
	map: string;
	durationSeconds: number | null;
	players: TournamentResultPlayer[];
};

export const TOURNAMENT_POST_KINDS = [
	'announcement',
	'rules',
	'schedule',
	'deadlines',
	'disqualified',
	'seeded',
	'started',
	'finished',
	'cancelled'
] as const;

/** `announcement` is written by staff; the other kinds are posted automatically. */
export type TournamentPostKind = (typeof TOURNAMENT_POST_KINDS)[number];

/** A post on the tournament's Updates tab. Participants get a notification for each one. */
export type TournamentPost = {
	id: string;
	kind: TournamentPostKind;
	/** Staff posts only; automatic posts are worded by the client from `kind` and `data`. */
	title: string;
	/** Markdown. */
	body: string;
	/**
	 * Automatic posts: `startsAt` (schedule), `rounds` (deadlines, `roundKey` → ISO or null),
	 * `alias` (disqualified), `players` (started), `champion` (finished).
	 */
	data: Record<string, unknown>;
	/** Also shown as a popup to every participant. */
	important: boolean;
	pinned: boolean;
	created: string;
	updated: string;
};

export type TournamentPostInput = {
	title: string;
	body: string;
	important: boolean;
	pinned: boolean;
};

/** An important post the participant has not seen yet (popup). */
export type TournamentPostNotice = {
	post: TournamentPost;
	tournament: Pick<Tournament, 'id' | 'name' | 'slug' | 'format' | 'logoUrl' | 'medal'>;
};

export const TOURNAMENT_REPORT_REASONS = [
	'no_show',
	'disconnect',
	'wrong_result',
	'conduct',
	'other'
] as const;

export type TournamentReportReason = (typeof TOURNAMENT_REPORT_REASONS)[number];

/** A participant's problem with their match, sent to staff. */
export type TournamentReport = {
	reason: TournamentReportReason;
	message: string;
};

export type TournamentReportStatus = 'open' | 'resolved' | 'dismissed';

/** A report as the player who sent it sees it. */
export type MyTournamentReport = TournamentReport & {
	id: string;
	status: TournamentReportStatus;
	/** Staff's answer, shown once the report is handled. */
	staffNote: string;
	created: string;
	handledAt: string | null;
};

/** A report in the staff list. */
export type TournamentReportRecord = MyTournamentReport & {
	match: Pick<TournamentMatch, 'id' | 'bracket' | 'round' | 'position' | 'status'>;
	/** Rounds in the match's bracket, for `roundLabel`. */
	rounds: number;
	reporter: { id: string; name: string };
	/** The reporter's participant, when they still are one. */
	participant: string | null;
	playerA: string | null;
	playerB: string | null;
	handledBy: { id: string; name: string } | null;
};

export type TournamentReportUpdate = {
	status: TournamentReportStatus;
	staffNote: string;
};

/** What the result, start and update popups of the signed-in player have shown. */
export type TournamentSeen = {
	/** Processed games (lobby ids). */
	lobbyIds?: string[];
	/** Tournaments whose start popup was shown. */
	started?: string[];
	/** Tournaments whose important posts were shown (all posts until now). */
	posts?: string[];
};

/** A tournament the player is in that started recently ("tournament has started" popup). */
export type TournamentStart = {
	tournament: Pick<
		Tournament,
		'id' | 'name' | 'slug' | 'format' | 'logoUrl' | 'bannerUrl' | 'medal' | 'participantCount'
	>;
	/** The player's first match, or null with a bye or before the bracket has a match for them. */
	match: MyTournamentMatch | null;
};

export type MyTournaments = {
	matches: MyTournamentMatch[];
	results: TournamentGameResult[];
	/** Started tournaments whose popup the player has not seen yet. */
	started: TournamentStart[];
	/** Important updates of their tournaments they have not seen yet, oldest first. */
	posts: TournamentPostNotice[];
	/** The player has signed in to the desktop app at least once. */
	hasApp: boolean;
};

export type TournamentStanding = {
	participant: string;
	played: number;
	wins: number;
	losses: number;
	gamesWon: number;
	gamesLost: number;
};

export type TournamentDetail = {
	tournament: Tournament;
	participants: TournamentParticipant[];
	matches: TournamentMatch[];
	/** Round robin only, best first. */
	standings: TournamentStanding[];
	/** Games whose match has a stored replay (hidden matches left out). */
	replays: TournamentReplay[];
	/** The Updates tab, pinned first, then newest first. */
	posts: TournamentPost[];
	/** Staff only: open problem reports; 0 for everyone else. */
	openReports: number;
};

/** Faction totals of a finished tournament. */
export type TournamentFactionStat = {
	raceId: number;
	picks: number;
	wins: number;
};

export type TournamentMapStat = {
	map: string;
	games: number;
};

/** One notable game in the stats (longest, shortest, upset). */
export type TournamentStatGame = {
	lobbyId: string;
	matchId: string;
	map: string;
	durationSeconds: number | null;
	/** Participant ids. */
	winner: string;
	loser: string;
};

/** Numbers of a finished (or cancelled) tournament; never shown while games are hidden. */
export type TournamentStats = {
	games: number;
	matches: number;
	walkovers: number;
	totalSeconds: number;
	factions: TournamentFactionStat[];
	maps: TournamentMapStat[];
	longest: TournamentStatGame | null;
	shortest: TournamentStatGame | null;
	/** Match won by the player with the highest seed number over the lowest. */
	upset: (TournamentStatGame & { winnerSeed: number; loserSeed: number }) | null;
	/** Participants with the most games played, most first. */
	mostGames: { participant: string; games: number }[];
	/** The champion's matches, first round first. */
	championPath: string[];
};

/** A finished tournament in the hall of fame. */
export type HallOfFameEntry = {
	tournament: Pick<
		Tournament,
		'id' | 'name' | 'slug' | 'format' | 'logoUrl' | 'medal' | 'participantCount' | 'startsAt'
	>;
	finishedAt: string;
	/** First, second and third place (two thirds in elimination), by placement. */
	podium: {
		placement: number;
		alias: string;
		steamId: string;
		country: string;
	}[];
};

/** A player with titles or podiums, by Steam id. */
export type HallOfFamePlayer = {
	steamId: string;
	alias: string;
	country: string;
	titles: number;
	podiums: number;
};

export type HallOfFame = {
	tournaments: HallOfFameEntry[];
	/** Most titles first, then most podiums. */
	players: HallOfFamePlayer[];
};

export type TournamentReplay = {
	/** The community match (lobby) of the game; its page is the replay viewer. */
	lobbyId: string;
	map: string;
	durationSeconds: number | null;
};

export type TournamentInput = {
	name: string;
	description: string;
	rules: string;
	format: TournamentFormat;
	bestOf: number;
	finalsBestOf: number | null;
	grandFinalReset: boolean;
	registrationClosesAt: string | null;
	startsAt: string | null;
	maxParticipants: number | null;
	/** Map references (see `./maps`), in pool order. */
	mapPool: string[];
	/** Champion medal (e.g. `medal-042`), or null for the default. */
	medal?: string | null;
	/** Cast / stream link (https), or null. */
	streamUrl?: string | null;
};

export const TOURNAMENT_BANNER_MAX_BYTES = 5 * 1024 * 1024;
export const TOURNAMENT_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const TOURNAMENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** New images to upload, or `clear*` to remove the current one; left out keeps it. */
export type TournamentImages = {
	banner?: File | null;
	logo?: File | null;
	clearBanner?: boolean;
	clearLogo?: boolean;
};

export type TournamentUpdate = Partial<TournamentInput> & {
	status?: 'draft' | 'registration' | 'cancelled';
};

/** Staff: put a match in the spotlight (null clears it). */
export type TournamentFeature = { matchId: string | null };

export type TournamentMatchResult =
	| { winsA: number; winsB: number }
	| { walkover: TournamentSlot }
	| { reset: true };

/** Wins needed to take a best-of-`bestOf` match. */
export function winsNeeded(bestOf: number): number {
	return Math.floor(bestOf / 2) + 1;
}
