import { getContext, hasContext, setContext } from 'svelte';
import type { LobbyComment, MentionUser } from '../comment/types';
import type { CommentVoteValue } from '../comment/vote';
import type { LiveLobbyPlayer } from '../live-lobby/types';
import type { ProfileLinkFields } from '../player/profile';
import type { PlayerLabel } from '../format/types';
import type {
	LeaderboardStat,
	PlayerCustomization,
	PlayerEloMap,
	PlayerPreviewData
} from '../player/types';
import type { CommunityMatchDetail, MatchResultPlayer } from '../replay/types';
import type { PlayerRewards } from '../reward/types';
import type { DocKind } from '@company-of-heroes/game-data/types';
import type { DocsNote } from '../docs/types';
import type { Medal } from '../tournament/medal';
import type { HostNotification } from '../notifications/types';
import type {
	HallOfFame,
	MyTournamentHostRequest,
	MyTournaments,
	Tournament,
	TournamentDetail,
	TournamentHost,
	TournamentHostDecision,
	TournamentHostRequest,
	TournamentHostRequestInput,
	TournamentImages,
	TournamentInput,
	TournamentMap,
	TournamentMatch,
	TournamentMatchResult,
	TournamentPost,
	TournamentPostInput,
	TournamentReport,
	TournamentReportRecord,
	TournamentReportUpdate,
	TournamentScheduleProposal,
	TournamentScope,
	TournamentSeen,
	TournamentStats,
	TournamentUpdate
} from '../tournament/types';

/**
 * Everything a shared component needs from the host (desktop app or website).
 * Each host provides this once in its root layout; shared components never import host code.
 */
export type HostUser = {
	id: string;
	name: string;
	avatarUrl?: string;
	steamIds: string[];
	isStaff: boolean;
	/** Staff or a community host: may create tournaments (hosts run only their own). */
	canHost: boolean;
};

/** A comment thread lives on a saved lobby or a member replay. */
export type CommentTarget = {
	kind: 'replay' | 'lobby';
	id: string;
};

export type PlayerSearchOption = {
	/** SteamID64. */
	value: string;
	label: string;
	avatarUrl?: string | null;
	country?: string | null;
	profileId?: number | null;
};

/** Something people can up/down vote. */
export type LikeTarget = {
	kind: 'player' | 'replay' | 'lobby';
	/** Steam ID for players, record id for replays / lobbies. */
	id: string;
};

export type CompanionUserDebug = {
	id: string;
	email: string;
	role?: string;
	lastLogin?: string;
	created?: string;
	updated?: string;
	appVersion: string | null;
};

export type HostRoutes = {
	player: (idOrSteamId: string | number) => string;
	/** Detail page of a saved match / replay, by lobby id. */
	match: (lobbyId: string) => string;
	accountProfile: (steamId: string) => string;
	/** Login page that returns to the current page afterwards. */
	login: () => string;
	memberReplays: () => string;
	memberReplay: (replayId: string) => string;
	/** Upload page that publishes a saved match (lobby id) as a member replay. */
	publishReplay: (lobbyId: string) => string;
	/** Back link of replay detail pages (the list the viewer came from). */
	replayList: () => string;
	/** Absolute public website URL of a match / member replay; offline hosts omit it. */
	shareReplay?: (id: string) => string;
	/** Owner edit page of a member replay; hosts that edit in place omit it. */
	editReplay?: (replayId: string) => string;
	tournaments: () => string;
	tournament: (slug: string) => string;
	/** Staff create and edit pages. */
	tournamentNew: () => string;
	tournamentEdit: (slug: string) => string;
	/** Where to get the desktop app; the app itself omits it. */
	downloadApp?: () => string;
	tournamentHallOfFame: () => string;
	/** Dev-only tournament simulator (website in dev mode); hosts without it hide the links. */
	tournamentSimulator?: (slug?: string) => string;
};

/** Parsed-replay roster entry as sent to rating previews / uploads. */
export type ReplayRosterPlayer = {
	id?: number;
	name: string;
	faction: string;
	doctrine?: number;
	doctrineName?: string;
	steamId?: string | null;
};

export type MemberReplayRatingPreview = {
	matchtype_id?: number;
	players: MatchResultPlayer[];
	livePlayers: LiveLobbyPlayer[];
};

export type MemberReplayUpload = {
	file: File;
	filename: string;
	title: string;
	description: string;
	mapName: string;
	mapFilename: string;
	durationInSeconds: number;
	gameDate?: string;
	isRanked: boolean;
	isVpGame: boolean;
	isRandomStart: boolean;
	isHighResources: boolean;
	vpCount: number;
	players: ReplayRosterPlayer[];
	messages: unknown[];
};

export type PublishFromMatch = {
	title: string;
	description: string;
	durationInSeconds: number;
	players: ReplayRosterPlayer[];
};

export type HostResolvers = {
	flagImageUrl: (country: string | null | undefined) => string | null;
	avatarUrl: (url: string) => string;
	mapSrc: (map: string | undefined) => string | undefined;
	/** Placeholder when a map image is missing. */
	mapFallbackSrc: () => string | undefined;
	factionFlagByRace: (raceId: number) => string;
	factionFlagByLeaderboard: (leaderboardId: number) => string;
	rankImageByRace: (raceId: number, rankLevel: number) => string;
	rankImageByLeaderboard: (leaderboardId: number, rankLevel: number) => string;
	/** Optional: resolve `$123` game string ids (desktop has the game locale tables). */
	gameString?: (key: string) => string | null;
	/** URL for a doctrine banner file name (see `doctrineBannerFile`). */
	doctrineBanner: (file: string) => string;
	/** URL for a replay action icon key (see `actionIconKey`). */
	actionIcon: (key: string) => string | undefined;
	/** Champion medals from `shared-assets/medals`, in file order. Hosts without them return []. */
	medals: () => Medal[];
	/** Avatar for a comment author / mention; hosts may add a generated fallback. */
	userAvatar: (user: { id: string; avatarUrl?: string }) => string | undefined;
};

export type HostApi = {
	players: {
		getPreview: (id: string) => Promise<PlayerPreviewData | null>;
		/** Players with community matches, for linking replay slots to Steam accounts. */
		search: (query: string) => Promise<PlayerSearchOption[]>;
		/** Stored lobby ELO per ladder, keyed like `PlayerEloMap`. */
		getElo: (steamId: string) => Promise<PlayerEloMap>;
		/** Full ladder stats list + stored ELO (Steam id or profile id); null when not found. */
		getStats: (
			id: string
		) => Promise<{ leaderboardStats: LeaderboardStat[]; elo: PlayerEloMap } | null>;
	};
	social: {
		getMyVote: (target: LikeTarget) => Promise<CommentVoteValue>;
		/** Voting the same way twice removes the vote. */
		setVote: (
			target: LikeTarget,
			value: 1 | -1
		) => Promise<{ vote: CommentVoteValue; likeCount: number }>;
	};
	comments: {
		list: (target: CommentTarget) => Promise<LobbyComment[]>;
		create: (target: CommentTarget, text: string, parentId?: string) => Promise<LobbyComment>;
		update: (kind: CommentTarget['kind'], commentId: string, text: string) => Promise<LobbyComment>;
		/** Staff pass a moderator note; the comment is soft-deleted. */
		remove: (
			kind: CommentTarget['kind'],
			commentId: string,
			note?: string
		) => Promise<LobbyComment>;
		vote: (
			kind: CommentTarget['kind'],
			commentId: string,
			value: 1 | -1
		) => Promise<{ vote: CommentVoteValue; likeCount: number }>;
		searchMentions: (query: string) => Promise<MentionUser[]>;
	};
	replays: {
		previewRatings: (input: {
			players: { name: string; steamId: string | null; faction: string; id?: number }[];
			isRanked: boolean;
			durationInSeconds: number;
		}) => Promise<MemberReplayRatingPreview>;
		upload: (input: MemberReplayUpload) => Promise<{ id: string }>;
		publishFromMatch: (lobbyId: string, input: PublishFromMatch) => Promise<{ id: string }>;
		/**
		 * Replay file of a saved match the viewer may publish. Throws with a user-facing message;
		 * resolves null when the host already navigated away (e.g. it is published already).
		 * `players` pre-links Steam ids the .rec file does not carry; `result` holds the match's
		 * own ratings for the preview.
		 */
		loadMatchForPublish: (lobbyId: string) => Promise<{
			file: File;
			title?: string;
			map?: string;
			isRanked?: boolean;
			players?: { name: string; steamId: string | null }[];
			result?: CommunityMatchDetail['result'] | null;
		} | null>;
		/** Owner edit of a member replay. */
		update: (
			replayId: string,
			input: { title: string; description: string; players: unknown[] }
		) => Promise<void>;
		/** Owner soft-delete of a member replay. */
		remove: (replayId: string) => Promise<void>;
		/** Raw .rec bytes of a match / member replay, for parsing in the browser. */
		getFile: (match: CommunityMatchDetail) => Promise<Uint8Array>;
		/** Browser download link; hosts that save files themselves return null. */
		downloadHref: (match: CommunityMatchDetail) => string | null;
		/**
		 * Called on download: counts it (link download) or saves the file (desktop).
		 * Resolves the new download count when the host knows it.
		 */
		download: (match: CommunityMatchDetail) => Promise<{ downloadCount?: number } | void>;
		/**
		 * A participant attaches the missing replay of a saved match; the longer (or larger)
		 * file is kept. Hosts refresh the match afterwards. Throws with a user-facing message.
		 * Hosts without it hide the upload prompt.
		 */
		attach?: (
			lobbyId: string,
			file: File,
			durationSeconds: number
		) => Promise<{ keptExisting: boolean }>;
	};
	hiddenMatches: {
		isHidden: (sessionId: number) => Promise<boolean>;
		setHidden: (sessionId: number, hidden: boolean) => Promise<void>;
	};
	profile: {
		/** Steam account whose public profile the viewer edits (`?steamId=` when owned). */
		steamId: () => string | null;
		get: (steamId: string) => Promise<PlayerCustomization>;
		/** Validates the links; rejects with a user-facing message. */
		save: (input: {
			steamId: string;
			bio: string;
			links: ProfileLinkFields;
			background: File | null;
			clearBackground: boolean;
		}) => Promise<PlayerCustomization>;
	};
	labels: {
		/** Reactive: empty until the host has loaded (batched, cached) the labels for this Steam id. */
		forSteamId: (steamId: string) => PlayerLabel[];
	};
	streaming: {
		/** Reactive: true while the player with this Steam id is streaming Company of Heroes. */
		isLive: (steamId: string) => boolean;
	};
	rewards: {
		/** Unlocked rewards; the owner also gets locked ones with progress. */
		forPlayer: (steamId: string) => Promise<PlayerRewards>;
	};
	staff: {
		getCompanionUser: (steamId: string) => Promise<CompanionUserDebug | null>;
	};
	/** Optional: staff tips on the docs pages. Hosts without docs omit it. */
	docs?: {
		/** Staff only; an empty body removes the tip. Rejects with a user-facing message. */
		saveNote: (kind: DocKind, slug: string, body: string) => Promise<DocsNote | null>;
		/**
		 * Signed-in users report wrong info on the current wiki page; staff get notified.
		 * Rejects with a user-facing message. Hosts without it hide the report button.
		 */
		reportIssue?: (page: string, description: string) => Promise<void>;
	};
	/** Tournaments; every call rejects with a user-facing message. Staff-only calls are checked by the server. */
	tournaments: {
		list: (scope: TournamentScope) => Promise<Tournament[]>;
		get: (idOrSlug: string) => Promise<TournamentDetail>;
		/** Finished tournaments the player won, newest first. */
		wonBy: (steamId: string) => Promise<Tournament[]>;
		create: (input: TournamentInput, images?: TournamentImages) => Promise<Tournament>;
		update: (id: string, input: TournamentUpdate, images?: TournamentImages) => Promise<Tournament>;
		/** Staff-made maps; built-in maps are `BUILT_IN_MAPS`. */
		listMaps: () => Promise<TournamentMap[]>;
		/** Staff only. */
		createMap: (name: string, icon: File | null) => Promise<TournamentMap>;
		/** `acceptRules` is required when the tournament has rules. */
		register: (id: string, steamId: string, acceptRules: boolean) => Promise<TournamentDetail>;
		/** A participant accepts the current rules (again). */
		acceptRules: (id: string) => Promise<TournamentDetail>;
		withdraw: (id: string) => Promise<TournamentDetail>;
		/** Closes registration and seeds by 1v1 ELO. */
		seed: (id: string) => Promise<TournamentDetail>;
		/** Participant ids, top seed first. */
		setSeeds: (id: string, order: string[]) => Promise<TournamentDetail>;
		start: (id: string) => Promise<TournamentDetail>;
		setMatchResult: (
			id: string,
			matchId: string,
			result: TournamentMatchResult
		) => Promise<TournamentMatch[]>;
		disqualify: (id: string, participantId: string) => Promise<TournamentDetail>;
		/** Staff: last moment to play per round (`roundKey` → ISO date, null clears it). */
		setRoundDeadlines: (
			id: string,
			rounds: Record<string, string | null>
		) => Promise<TournamentDetail>;
		/** Staff: a deadline for one match (null: its round's again). */
		setMatchDeadline: (
			id: string,
			matchId: string,
			deadline: string | null
		) => Promise<TournamentDetail>;
		/** The signed-in player's open matches and the popups they have not seen yet. */
		mine: () => Promise<MyTournaments>;
		/** The popups of these games, tournament starts and updates were shown. */
		markSeen: (seen: TournamentSeen) => Promise<void>;
		/** Staff: a post on the Updates tab; participants get a notification. */
		createPost: (id: string, input: TournamentPostInput) => Promise<TournamentPost>;
		updatePost: (id: string, postId: string, input: TournamentPostInput) => Promise<TournamentPost>;
		deletePost: (id: string, postId: string) => Promise<void>;
		/** A participant reports a problem with their match to staff. */
		report: (id: string, matchId: string, report: TournamentReport) => Promise<void>;
		/** Staff: every problem report of the tournament, newest first. */
		reports: (id: string) => Promise<TournamentReportRecord[]>;
		/** Staff: resolve or dismiss a report; the reporter hears the note. */
		updateReport: (
			id: string,
			reportId: string,
			update: TournamentReportUpdate
		) => Promise<TournamentReportRecord>;
		/** A player proposes 1–3 times for their match. */
		proposeTimes: (
			id: string,
			matchId: string,
			times: string[]
		) => Promise<TournamentScheduleProposal>;
		acceptTime: (
			id: string,
			matchId: string,
			proposalId: string,
			time: string
		) => Promise<TournamentScheduleProposal>;
		declineTimes: (
			id: string,
			matchId: string,
			proposalId: string
		) => Promise<TournamentScheduleProposal>;
		/** Staff: set or clear the agreed time of a match. */
		setMatchTime: (
			id: string,
			matchId: string,
			scheduledAt: string | null
		) => Promise<TournamentDetail>;
		/** Staff: put a match in the spotlight (null clears it). */
		feature: (id: string, matchId: string | null) => Promise<TournamentDetail>;
		/** Numbers of a finished tournament. */
		stats: (idOrSlug: string) => Promise<TournamentStats>;
		hallOfFame: () => Promise<HallOfFame>;
		/** The signed-in user's latest request to host tournaments, or null. */
		myHostRequest: () => Promise<MyTournamentHostRequest | null>;
		requestHost: (input: TournamentHostRequestInput) => Promise<MyTournamentHostRequest>;
		/** Staff: requests to host, open ones first. */
		hostRequests: () => Promise<TournamentHostRequest[]>;
		/** Staff: approving gives the user the host role. */
		decideHostRequest: (
			requestId: string,
			decision: TournamentHostDecision
		) => Promise<TournamentHostRequest>;
		/** Staff: everyone with the host role. */
		hosts: () => Promise<TournamentHost[]>;
		revokeHost: (userId: string) => Promise<void>;
	};
	/** The signed-in user's notifications (bell). */
	notifications: {
		/** Newest first. */
		list: () => Promise<HostNotification[]>;
		unreadCount: () => Promise<number>;
		markRead: (id: string) => Promise<void>;
		/**
		 * Realtime hosts call `onChange` when a notification arrives or is read; the bell then
		 * reloads. Hosts without it are polled by the bell. Returns the unsubscribe.
		 */
		subscribe?: (onChange: () => void) => () => void;
	};
	/** Optional: machine-translate chat text. Hosts without it hide the translate controls. */
	translate?: (text: string, to: string) => Promise<string>;
};

export type HostContext = {
	locale: () => string;
	/**
	 * Opens an outside link (Steam profile, `steam://` add friend) in the browser or Steam.
	 * Hosts without it let the link open itself.
	 */
	openExternal?: (url: string) => void;
	/** Localize an internal path (website adds the locale prefix; the app returns it as is). */
	href: (path: string) => string;
	routes: HostRoutes;
	url: {
		/** Current page search param. */
		param: (name: string) => string | null;
		/** Remove a search param from the current URL without navigating. */
		dropParam: (name: string) => void;
		/** Client-side navigation. */
		goto: (path: string) => Promise<void>;
	};
	resolve: HostResolvers;
	auth: {
		readonly user: HostUser | null;
		isSelf: (steamId: string, profileId?: number) => boolean;
		/** Replay files only carry in-game aliases; true when the alias is the viewer. */
		isSelfAlias: (alias: string) => boolean;
	};
	/**
	 * Opens a notification from the bell: the host routes it (match, replay, tournament, page)
	 * or shows its body. Called after it was marked read.
	 */
	openNotification: (notification: HostNotification) => void;
	notify: {
		success: (message: string) => void;
		error: (message: string) => void;
		confirm: (message: string, labels?: { confirm?: string; cancel?: string }) => Promise<boolean>;
	};
	api: HostApi;
};

// String key (not runed's Symbol-based Context) so the key survives HMR re-evaluation of this module.
const KEY = '<host />';

export const provideHost = (host: HostContext) => setContext(KEY, host);

export const useHost = (): HostContext => {
	if (!hasContext(KEY)) {
		throw new Error(`Context "${KEY}" not found`);
	}

	return getContext<HostContext>(KEY);
};

/** For components that also render outside a host (e.g. isolated previews). */
export const tryUseHost = (): HostContext | null =>
	hasContext(KEY) ? getContext<HostContext>(KEY) : null;
