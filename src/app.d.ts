declare module '@fknoobs/app' {
	import type { Auth } from '$features/auth';
	import type { Twitch, TTS } from '$features/twitch';
	import type { Shortcuts } from '$features/shortcuts';
	import type { TTSPersonalVoices } from '$features/tts-personal-voices';
	import type { TwitchBot } from '$features/twitch-bot';
	import type { Updater } from '$features/updater';
	import type { History } from '$features/history';
	import type { ReplayAnalyzer } from '$features/replay-analyzer';
	import type { TwitchOverlays } from '$core/app/features/twitch-overlays';
	import type { Replays } from '$lib/modules/replay-manager/replays.svelte';

	interface Features {
		auth: Auth;
		twitch: Twitch;
		shortcuts: Shortcuts;
		updater: Updater;
		history: History;
		'twitch-overlays': TwitchOverlays;
		'replay-analyzer': Replays;
		'text-to-speech': TTS;
		'twitch-bot': TwitchBot;
		'text-to-speech-custom-characters': TTSPersonalVoices;
	}

	type RelicProfile = {
		alias: string;
		profile_id: number;
		name: string;
		personal_statgroup_id: number;
		xp: number;
		level: number;
		leaderboardregion_id: number;
		country: string;
		leaderboardStats?: LeaderboardStat[];
	};

	type Result = {
		code: number;
		message: string;
	};

	// Assuming members contain RelicProfile based on context, adjust if needed
	type StatGroup = {
		id: number;
		name: string;
		type: number;
		members: RelicProfile[]; // Or specify a more concrete type if known, e.g., RelicProfile[]
	};

	type LeaderboardStat = {
		statgroup_id: number;
		leaderboard_id: number;
		wins: number;
		losses: number;
		streak: number;
		disputes: number;
		drops: number;
		rank: number;
		ranktotal: number;
		ranklevel: number;
		regionrank: number;
		regionranktotal: number;
		lastmatchdate: number; // Unix timestamp
		highestrank: number;
		highestranklevel: number;
	};

	type ReplayMessage = {
		tick: number;
		sender: string;
		senderID: number;
		content: string;
		recipient: number;
	};

	type ReplayPlayer = {
		name: string;
		faction: string;
		id: number;
		doctrine: number;
	};

	type ReplayAction = {
		tick: number;
		data: Uint8Array;
		rawHex: string;
		playerID: number;
		playerName: string;
		timestamp: string;
	};

	type LeaderboardStatWithProfile = LeaderboardStat & {
		profile: RelicProfile;
	};

	type PersonalStat = {
		result: Result;
		statGroups: StatGroup[];
		leaderboardStats: LeaderboardStat[];
	};

	type LeaderBoardResponse = {
		rankTotal: number;
	} & PersonalStat;

	type LobbyPlayer = {
		index: number;
		playerId: number;
		type: number;
		team: number;
		race: number;
		ranking?: number;
		slot?: number;
		steamId?: string;
		profile?: RelicProfile; // Computers dont have profiles
	};

	interface MatchHistoryPlayer {
		// Profile data
		profile_id: number;
		name: string;
		alias: string;
		personal_statgroup_id: number;
		xp: number;
		level: number;
		leaderboardregion_id: number;
		country: string;
		steamId: string;

		// Report results
		resulttype: number;
		teamid: number;
		race_id: number;
		xpgained: number;
		counters: string;
		matchstartdate: number;

		// Member data
		statgroup_id: number;
		wins: number;
		losses: number;
		streak: number;
		arbitration: number;
		outcome: number;
		oldrating: number;
		newrating: number;
		reporttype: number;
	}

	interface TransformedMatch {
		// Match basic info
		id: number;
		creator_profile_id: number;
		mapname: string;
		maxplayers: number;
		matchtype_id: number;
		options: string;
		slotinfo: string;
		description: string;
		startgametime: number;
		completiontime: number;
		observertotal: number;
		outcome: number;

		// Combined player data
		players: MatchHistoryPlayer[];
	}

	type Match = TransformedMatch;

	interface OriginalMatchHistory {
		matchHistoryStats: Array<{
			id: number;
			creator_profile_id: number;
			mapname: string;
			maxplayers: number;
			matchtype_id: number;
			options: string;
			slotinfo: string;
			description: string;
			startgametime: number;
			completiontime: number;
			observertotal: number;
			matchhistoryreportresults: Array<{
				matchhistory_id: number;
				profile_id: number;
				resulttype: number;
				teamid: number;
				race_id: number;
				xpgained: number;
				counters: string;
				matchstartdate: number;
			}>;
			matchhistoryitems: any[];
			matchurls: any[];
			matchhistorymember: Array<{
				matchhistory_id: number;
				profile_id: number;
				race_id: number;
				statgroup_id: number;
				teamid: number;
				wins: number;
				losses: number;
				streak: number;
				arbitration: number;
				outcome: number;
				oldrating: number;
				newrating: number;
				reporttype: number;
			}>;
		}>;
		profiles: Array<{
			profile_id: number;
			name: string;
			alias: string;
			personal_statgroup_id: number;
			xp: number;
			level: number;
			leaderboardregion_id: number;
			country: string;
		}>;
	}

	export type CoHMaps =
		| '2p_angoville farms'
		| '2p_beach_assault'
		| '2p_beaux lowlands'
		| '2p_bernieres-sur-mer'
		| '2p_best'
		| '2p_carpiquet'
		| '2p_circle_wall'
		| '2p_flooded_plains'
		| '2p_langres'
		| '2p_lyon'
		| '2p_semois'
		| '2p_st_mere_dumont'
		| '2p_sturzdorf'
		| '2p_verrieres_ridge'
		| '2p_verrieres_ridge_no_bunkers'
		| '2p_wrecked_train'
		| '2p_duclair'
		| '2p_egletons'
		| '2p_industrial riverbed'
		| '2p_ruins of rouen'
		| '4p_alsace moselle'
		| '4p_duclair'
		| '4p_road to montherme'
		| '6p_red_ball_express'
		| '6p_vimoutiers'
		| '4p_achelous river'
		| '4p_bedum'
		| '4p_coastal_harbour'
		| '4p_ecliptic fields'
		| '4p_etavaux'
		| '4p_linden'
		| '4p_lorraine'
		| '4p_lyon'
		| '4p_mcgechaens war'
		| '4p_point_du_hoc'
		| '4p_rails and metal'
		| '4p_st hilaire'
		| '4p_vire river valley'
		| '4p_wolfheze'
		| '6p_close_river_combat'
		| '6p_drekplaats'
		| '6p_hedgerow_siege'
		| '6p_hill 331'
		| '6p_montherme'
		| '6p_refinery'
		| '6p_seine_river_docks'
		| '6p_villers_bocage'
		| '8p_best'
		| '8p_king_of_the_hill'
		| '8p_montargis region'
		| '8p_route_n13'
		| '8p_steel_pact';

	type ToCamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
		? `${P1}${Capitalize<ToCamelCase<`${P2}${P3}`>>}`
		: S extends `${infer P1}-${infer P2}${infer P3}`
			? `${P1}${Capitalize<ToCamelCase<`${P2}${P3}`>>}`
			: S;

	export type Expand<T> =
		// First check if T has expand property with actual content
		T extends { expand: infer E }
			? E extends Record<string, any>
				? {
						// Keep non-expanded properties (excluding expand and relation keys)
						[P in keyof T as P extends 'expand' ? never : P extends keyof E ? never : P]: T[P];
					} & {
						// Add expanded properties with camelCase keys, handling optional properties
						[K in keyof E as ToCamelCase<string & K>]: undefined extends E[K]
							? E[K] extends infer U | undefined
								? U extends Array<infer ArrayItem>
									? Array<Expand<ArrayItem>> | undefined
									: U extends Record<string, any>
										? Expand<U> | undefined
										: E[K]
								: never
							: E[K] extends Array<infer U>
								? Array<Expand<U>>
								: E[K] extends Record<string, any>
									? Expand<E[K]>
									: E[K];
					}
				: T
			: // Handle arrays
				T extends Array<infer U>
				? Array<Expand<U>>
				: // Default case - return as is
					T;
}

declare module '@fknoobs/app/ws' {
	import type { RelicProfile, LobbyPlayer } from '@fknoobs/app';

	type GameEvents = {
		'GAME:LAUNCHED': Message<
			'GAME:LAUNCHED',
			{
				isRunning: boolean;
				steamId: string;
				profile: RelicProfile;
			}
		>;
		'LOBBY:STARTED': Message<
			'LOBBY:STARTED',
			{
				isStarted: boolean;
				map: string;
				outcome: 'PS_WON' | 'PS_LOST' | 'PS_ABORTED';
				players: LobbyPlayer[];
				matchType: number;
			}
		>;
		'LOBBY:GAMEOVER': Message<
			'LOBBY:GAMEOVER',
			{
				sessionId: number;
				isStarted: boolean;
				map: string;
				outcome: 'PS_WON' | 'PS_LOST' | 'PS_ABORTED';
				players: LobbyPlayer[];
			}
		>;
		'LOBBY:DESTROYED': Message<'LOBBY:DESTROYED'>;
		'GAME:CLOSED': Message<
			'GAME:CLOSED',
			{
				isRunning: boolean;
				steamId: string | null;
				profile: RelicProfile | null;
			}
		>;
	};

	type GameEvent = {
		[K in keyof GameEvents]: {
			type: K;
			data: GameEvents[K]['data'];
		};
	}[keyof GameEvents];

	// Combine GameEvents with potential future event types if needed
	type Events = GameEvents; // Add other event maps here using | if necessary

	type Event<T extends keyof Events = unkown> = {
		type: Events[T]['type'];
		data: Events[T]['data'];
	};

	type Message<T extends keyof Events, D extends Record<string, any>> = {
		type: T;
		data: D;
	};
}
