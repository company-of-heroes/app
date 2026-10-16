import { getContext, hasContext, setContext, type Snippet } from 'svelte';
import type { LobbyComment, MentionUser } from '../comment/types';
import type { CommentVoteValue } from '../comment/vote';
import type { LiveLobbyPlayer } from '../live-lobby/types';
import type { ProfileLinkFields } from '../player/profile';
import type { PlayerLabel } from '../format/types';
import type {
	LeaderboardStat,
	PlayerCustomization,
	PlayerEloMap,
	PlayerPreviewData,
	PlayerSearchPage
} from '../player/types';
import type { CommunityMatch, CommunityMatchDetail, MatchResultPlayer } from '../replay/types';
import type { PlayerRewards } from '../reward/types';
import type { DocKind } from '@company-of-heroes/game-data/types';
import type { DocsNote } from '../docs/types';
import type { Medal } from '../tournament/medal';
import type { Ribbon } from '../reward/ribbon';
import type { HostNotification } from '../notifications/types';
import type { HeadToHead } from '../head-to-head/types';
import type {
	Guide,
	GuideCategory,
	GuideCategoryInput,
	GuideCategoryTree,
	GuideCategoryUpdate,
	GuideImages,
	GuideInput,
	GuideLanguage,
	GuideList,
	GuideListQuery,
	GuideNav,
	GuideResolution,
	GuideSummary
} from '../guide/types';
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
	TournamentCustomMedal,
	TournamentMedalUse,
	TournamentPost,
	TournamentPostInput,
	TournamentReport,
	TournamentReportRecord,
	TournamentReportUpdate,
	TournamentScheduleProposal,
	TournamentScope,
	TournamentSeen,
	TournamentSlotRef,
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
	/** Staff or an editor: may publish guides. Every signed-in user may write drafts. */
	canPublish: boolean;
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
	/** Compare page of the signed-in user vs this player; hosts without accounts omit it. */
	compare?: (idOrSteamId: string | number, steamIds?: string[]) => string;
	accountProfile: (steamId: string) => string;
	/**
	 * Supporter player card page of a Steam ID: a site link on the website, the absolute
	 * website URL in the app (opened in the browser). Offline hosts return ''.
	 */
	playerCardUrl: (steamId: string) => string;
	/** Login page that returns to `next` (default: the current page) afterwards. */
	login: (next?: string) => string;
	/**
	 * Steam sign-in that finds or creates the account for that Steam ID and returns to the
	 * current page (a full page load). Left out where it does not exist (the desktop app).
	 */
	steamLogin?: () => string;
	/**
	 * Claim an unclaimed Steam account: Steam sign-in that adds the verified Steam ID to the
	 * signed-in account, or signs in (and creates the account) when signed out. Returns to the
	 * current page. Hosts that claim in place (the desktop app) use `auth.claimSteam` instead.
	 */
	steamClaim?: () => string;
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
	/** Wiki page of a built-in map; the app links to the website. Offline hosts omit it. */
	wikiMap?: (slug: string) => string;
	/** Dev-only tournament simulator (website in dev mode); hosts without it hide the links. */
	tournamentSimulator?: (slug?: string) => string;
	guides: () => string;
	/** A guide or category page by its unlocalized path (`/guides/wehrmacht/1v1/heavy-t1`). */
	guide: (path: string) => string;
	/** A guide in another language than the viewer's (a translation link). */
	guideIn: (path: string, language: GuideLanguage) => string;
	/** The editor's own guides. */
	guidesManage: () => string;
	guideEdit: (id: string) => string;
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

export type AvatarOptions = {
	/** PocketBase thumb size, e.g. `100x100`; ignored for other urls. */
	thumb?: string;
};

export type HostResolvers = {
	flagImageUrl: (country: string | null | undefined) => string | null;
	/** `thumb` (e.g. `100x100`) asks PocketBase for a thumbnail when the url is a PocketBase file. */
	avatarUrl: (url: string, options?: AvatarOptions) => string;
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
	/** Reward ribbons from `shared-assets/ribbons`, in file order. Hosts without them return []. */
	ribbons: () => Ribbon[];
	/** Supporter medal from shared-assets/supporter. */
	supporterMedal: () => string;
	/** Origin of PocketBase file urls (`https://api.coh1stats.com`); guide images may come from it. */
	filesOrigin: () => string;
	/** Avatar for a comment author / mention; hosts may add a generated fallback. */
	userAvatar: (
		user: { id: string; avatarUrl?: string },
		options?: AvatarOptions
	) => string | undefined;
};

export type HostApi = {
	players: {
		getPreview: (id: string) => Promise<PlayerPreviewData | null>;
		/** Players with community matches, for linking replay slots to Steam accounts. */
		search: (query: string) => Promise<PlayerSearchOption[]>;
		/** The players page: one page of players by name, most relevant first. */
		searchPage: (query: string, page: number) => Promise<PlayerSearchPage>;
		/** Stored lobby ELO per ladder, keyed like `PlayerEloMap`. */
		getElo: (steamId: string) => Promise<PlayerEloMap>;
		/** Full ladder stats list + stored ELO (Steam id or profile id); null when not found. */
		getStats: (
			id: string
		) => Promise<{ leaderboardStats: LeaderboardStat[]; elo: PlayerEloMap } | null>;
		/** The signed-in user's record against these Relic profiles, keyed by profile id. */
		headToHead: (profileIds: number[]) => Promise<Record<number, HeadToHead>>;
		/** History rows of the games behind a record (`HeadToHeadGame.lobbyId`), in that order. */
		headToHeadMatches: (lobbyIds: string[]) => Promise<CommunityMatch[]>;
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
		/** The medal every tournament uses, so the picker can mark them as taken. */
		usedMedals: () => Promise<TournamentMedalUse[]>;
		/** Staff only. */
		createMap: (name: string, icon: File | null) => Promise<TournamentMap>;
		/** Uploaded medals, newest first; built-in ones come from `resolve.medals`. */
		listMedals: () => Promise<TournamentCustomMedal[]>;
		/** Staff and hosts upload a medal (PNG or SVG). */
		createMedal: (name: string, image: File) => Promise<TournamentCustomMedal>;
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
		/** Staff or the host: build the bracket during seeding without starting, or throw it away. */
		generateBracket: (id: string) => Promise<TournamentDetail>;
		discardBracket: (id: string) => Promise<TournamentDetail>;
		/** Staff or the host: swap the players in two bracket places (unplayed matches only). */
		swapPlayers: (
			id: string,
			a: TournamentSlotRef,
			b: TournamentSlotRef
		) => Promise<TournamentDetail>;
		/** Staff or the host: soft delete (hidden from the public) and undo it. */
		remove: (id: string) => Promise<TournamentDetail>;
		restore: (id: string) => Promise<TournamentDetail>;
		setMatchResult: (
			id: string,
			matchId: string,
			result: TournamentMatchResult
		) => Promise<TournamentMatch[]>;
		/** Staff or the host add a player by Steam id (until the tournament starts). */
		addParticipant: (id: string, steamId: string) => Promise<TournamentDetail>;
		/** Staff or the host take a player out before the start (once running: disqualify). */
		removeParticipant: (id: string, participantId: string) => Promise<TournamentDetail>;
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
	/** Guides; every call rejects with a user-facing message. Editor and staff checks happen on the server. */
	guides: {
		/** The category tree and the published guides directly under `categoryId`. */
		nav: (language: GuideLanguage, categoryId?: string | null) => Promise<GuideNav>;
		list: (query: GuideListQuery) => Promise<GuideList>;
		/** What `/guides/<path>` shows in a language, or where its guide moved to. */
		resolve: (path: string, language: GuideLanguage, page?: number) => Promise<GuideResolution>;
		/** By id; drafts for whoever may edit them. */
		get: (id: string) => Promise<Guide>;
		/** Their own guides; staff: every guide. */
		mine: () => Promise<GuideSummary[]>;
		/** Starts an empty draft. */
		create: (language: GuideLanguage) => Promise<Guide>;
		update: (id: string, input: GuideInput, images?: GuideImages) => Promise<Guide>;
		/** An inline image; the url goes into the body. */
		uploadImage: (id: string, file: File) => Promise<{ name: string; url: string }>;
		/** Sends a draft, or a published guide's held changes, to staff for review. */
		requestReview: (id: string) => Promise<Guide>;
		/** Drops a published guide's held changes. */
		discardRevision: (id: string) => Promise<Guide>;
		remove: (id: string) => Promise<void>;
		categories: () => Promise<GuideCategoryTree[]>;
		/** Editors and staff add a category (top-level, or under a top-level one). */
		createCategory: (input: GuideCategoryInput) => Promise<GuideCategory>;
		/** Staff only. */
		updateCategory: (id: string, input: GuideCategoryUpdate) => Promise<GuideCategory>;
		deleteCategory: (id: string) => Promise<void>;
		/** Published guides in other languages, by title. */
		searchTranslations: (language: GuideLanguage, query: string) => Promise<GuideSummary[]>;
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
	/**
	 * Opens the supporters page, with the checkout when `checkout` is set. The website navigates
	 * there; the app opens it in the browser. Hosts without it hide the call to action.
	 */
	openSupporters?: (options?: { checkout?: boolean }) => void;
	/** Localize an internal path (website adds the locale prefix; the app returns it as is). */
	href: (path: string) => string;
	/**
	 * Hosts with their own header breadcrumbs (the app): pages hand over their steps and
	 * header actions instead of drawing a breadcrumb row. Returns a cleanup.
	 */
	breadcrumbs?: (steps: { label: string; href?: string }[], actions?: Snippet) => () => void;
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
		/**
		 * Claims a Steam account without leaving the page (the desktop app runs the Steam login in
		 * the browser). Resolves with an error message, or null once claimed or cancelled.
		 */
		claimSteam?: () => Promise<string | null>;
	};
	/**
	 * Opens a notification from the bell: the host routes it (match, replay, tournament, page)
	 * or shows its body. Called after it was marked read.
	 */
	openNotification: (notification: HostNotification) => void;
	notify: {
		success: (message: string) => void;
		error: (message: string) => void;
		/** `danger`: the action destroys or takes something away (red confirm button). */
		confirm: (
			message: string,
			labels?: { confirm?: string; cancel?: string; danger?: boolean }
		) => Promise<boolean>;
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
