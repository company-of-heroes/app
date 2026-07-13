import { LEADERBOARD_IDS, getRacePrefix } from './helpers';
import type { LeaderboardStat, LobbyData, MatchHistoryEntry, Player } from './types';

export type DevScenario = '1v1' | '2v2' | '3v3' | '4v4';

export const DEV_SCENARIOS: DevScenario[] = ['1v1', '2v2', '3v3', '4v4'];

const MATCH_TYPE: Record<DevScenario, number> = {
	'1v1': 1,
	'2v2': 2,
	'3v3': 3,
	'4v4': 4
};

const MATCH_LABEL: Record<DevScenario, string> = {
	'1v1': '1v1',
	'2v2': '2v2',
	'3v3': '3v3',
	'4v4': '4v4'
};

type PlayerConfig = {
	id: number;
	team: number;
	index: number;
	alias: string;
	country: string;
	race: 0 | 1 | 2 | 3;
	ranking: number;
	ranklevel: number;
	wins: number;
	losses: number;
	streak: number;
	elo: number;
};

function leaderboardId(matchType: number, race: number): number {
	const labels: Record<number, string> = {
		1: '1v1',
		2: '2v2',
		3: '3v3',
		4: '4v4'
	};
	const label = labels[matchType];
	if (!label) return 0;
	const key = `${label}_${getRacePrefix(race)}` as keyof typeof LEADERBOARD_IDS;
	return LEADERBOARD_IDS[key] ?? 0;
}

function makeStat(matchType: number, race: number, config: PlayerConfig): LeaderboardStat {
	const id = leaderboardId(matchType, race);
	return {
		disputes: 0,
		drops: 0,
		highestrank: config.ranking,
		highestranklevel: config.ranklevel,
		lastmatchdate: Date.now(),
		leaderboard_id: id,
		losses: config.losses,
		rank: config.ranking,
		ranklevel: config.ranklevel,
		ranktotal: 12_000,
		regionrank: Math.max(1, Math.round(config.ranking / 4)),
		regionranktotal: 3_000,
		statgroup_id: config.id,
		streak: config.streak,
		wins: config.wins
	};
}

function makeMatchHistory(matchType: number, config: PlayerConfig): MatchHistoryEntry[] {
	return [
		{
			matchtype_id: matchType,
			completiontime: Date.now(),
			startgametime: Date.now() - 1_800_000,
			players: [
				{
					profile_id: config.id,
					newrating: config.elo,
					oldrating: config.elo - (config.streak > 0 ? 12 : -8),
					race_id: config.race
				}
			]
		}
	];
}

function makePlayer(matchType: number, config: PlayerConfig): Player {
	return {
		index: config.index,
		playerId: config.id,
		profile: {
			alias: config.alias,
			country: config.country,
			leaderboardStats: [makeStat(matchType, config.race, config)],
			leaderboardregion_id: 1,
			level: 40,
			name: config.alias,
			personal_statgroup_id: config.id,
			profile_id: config.id,
			xp: 250_000
		},
		race: config.race,
		ranking: config.ranking,
		steamId: config.id === 1001 ? 'dev-steam-local' : `dev-steam-${config.id}`,
		team: config.team,
		type: matchType,
		matchHistory: makeMatchHistory(matchType, config)
	};
}

function groupByTeam(players: Player[]) {
	const grouped = new Map<number, Player[]>();
	for (const player of players) {
		const teamPlayers = grouped.get(player.team) ?? [];
		teamPlayers.push(player);
		grouped.set(player.team, teamPlayers);
	}
	return Array.from(grouped.entries()).map(([, teamPlayers]) => ({ players: teamPlayers }));
}

const SCENARIO_PLAYERS: Record<DevScenario, PlayerConfig[]> = {
	'1v1': [
		{
			id: 1001,
			team: 0,
			index: 0,
			alias: 'FkNoobs',
			country: 'NL',
			race: 0,
			ranking: 842,
			ranklevel: 14,
			wins: 312,
			losses: 198,
			streak: 4,
			elo: 1842
		},
		{
			id: 1002,
			team: 1,
			index: 1,
			alias: 'PanzerAce',
			country: 'DE',
			race: 1,
			ranking: 1204,
			ranklevel: 12,
			wins: 245,
			losses: 221,
			streak: -2,
			elo: 1768
		}
	],
	'2v2': [
		{
			id: 1001,
			team: 0,
			index: 0,
			alias: 'FkNoobs',
			country: 'NL',
			race: 0,
			ranking: 512,
			ranklevel: 15,
			wins: 189,
			losses: 102,
			streak: 3,
			elo: 1924
		},
		{
			id: 1003,
			team: 0,
			index: 1,
			alias: 'TommyAtkins',
			country: 'GB',
			race: 2,
			ranking: 980,
			ranklevel: 11,
			wins: 156,
			losses: 144,
			streak: 1,
			elo: 1688
		},
		{
			id: 1004,
			team: 1,
			index: 2,
			alias: 'BlitzKrieg',
			country: 'AT',
			race: 1,
			ranking: 734,
			ranklevel: 13,
			wins: 201,
			losses: 167,
			streak: 2,
			elo: 1810
		},
		{
			id: 1005,
			team: 1,
			index: 3,
			alias: 'StukaPilot',
			country: 'DE',
			race: 3,
			ranking: 1450,
			ranklevel: 10,
			wins: 98,
			losses: 112,
			streak: -1,
			elo: 1595
		}
	],
	'3v3': [
		{
			id: 1001,
			team: 0,
			index: 0,
			alias: 'FkNoobs',
			country: 'NL',
			race: 0,
			ranking: 428,
			ranklevel: 16,
			wins: 267,
			losses: 143,
			streak: 5,
			elo: 1988
		},
		{
			id: 1006,
			team: 0,
			index: 1,
			alias: 'ChurchillFan',
			country: 'GB',
			race: 2,
			ranking: 1102,
			ranklevel: 12,
			wins: 178,
			losses: 156,
			streak: 0,
			elo: 1722
		},
		{
			id: 1007,
			team: 0,
			index: 2,
			alias: 'RifleDoc',
			country: 'US',
			race: 0,
			ranking: 1560,
			ranklevel: 9,
			wins: 88,
			losses: 94,
			streak: 2,
			elo: 1540
		},
		{
			id: 1008,
			team: 1,
			index: 3,
			alias: 'WolfPack',
			country: 'DE',
			race: 1,
			ranking: 612,
			ranklevel: 14,
			wins: 224,
			losses: 188,
			streak: -3,
			elo: 1855
		},
		{
			id: 1009,
			team: 1,
			index: 4,
			alias: 'TigerTank',
			country: 'DE',
			race: 3,
			ranking: 890,
			ranklevel: 13,
			wins: 190,
			losses: 175,
			streak: 1,
			elo: 1799
		},
		{
			id: 1010,
			team: 1,
			index: 5,
			alias: 'Grenadier',
			country: 'AT',
			race: 1,
			ranking: 1320,
			ranklevel: 10,
			wins: 102,
			losses: 118,
			streak: -2,
			elo: 1612
		}
	],
	'4v4': [
		{
			id: 1001,
			team: 0,
			index: 0,
			alias: 'FkNoobs',
			country: 'NL',
			race: 0,
			ranking: 318,
			ranklevel: 17,
			wins: 402,
			losses: 228,
			streak: 6,
			elo: 2044
		},
		{
			id: 1011,
			team: 0,
			index: 1,
			alias: 'ShermanDriver',
			country: 'US',
			race: 0,
			ranking: 745,
			ranklevel: 13,
			wins: 210,
			losses: 198,
			streak: 1,
			elo: 1788
		},
		{
			id: 1012,
			team: 0,
			index: 2,
			alias: 'PIATsOnly',
			country: 'GB',
			race: 2,
			ranking: 1024,
			ranklevel: 11,
			wins: 165,
			losses: 149,
			streak: 3,
			elo: 1710
		},
		{
			id: 1013,
			team: 0,
			index: 3,
			alias: 'Airborne',
			country: 'US',
			race: 0,
			ranking: 1488,
			ranklevel: 9,
			wins: 92,
			losses: 108,
			streak: -1,
			elo: 1568
		},
		{
			id: 1014,
			team: 1,
			index: 4,
			alias: 'KingTiger',
			country: 'DE',
			race: 3,
			ranking: 402,
			ranklevel: 15,
			wins: 288,
			losses: 210,
			streak: 4,
			elo: 1912
		},
		{
			id: 1015,
			team: 1,
			index: 5,
			alias: 'Sturmtiger',
			country: 'DE',
			race: 1,
			ranking: 688,
			ranklevel: 12,
			wins: 198,
			losses: 182,
			streak: 0,
			elo: 1744
		},
		{
			id: 1016,
			team: 1,
			index: 6,
			alias: 'Elefant',
			country: 'DE',
			race: 3,
			ranking: 956,
			ranklevel: 11,
			wins: 144,
			losses: 160,
			streak: -2,
			elo: 1660
		},
		{
			id: 1017,
			team: 1,
			index: 7,
			alias: 'Ostfront',
			country: 'PL',
			race: 1,
			ranking: 1210,
			ranklevel: 10,
			wins: 118,
			losses: 132,
			streak: 1,
			elo: 1628
		}
	]
};

export function getDevScenarioFromUrl(): DevScenario {
	const param = new URLSearchParams(window.location.search).get('dev');
	if (param && DEV_SCENARIOS.includes(param as DevScenario)) {
		return param as DevScenario;
	}
	return '4v4';
}

export function getDevLobby(scenario: DevScenario): LobbyData {
	const matchType = MATCH_TYPE[scenario];
	const players = SCENARIO_PLAYERS[scenario].map((config) => makePlayer(matchType, config));

	return {
		isRanked: true,
		isSkirmish: false,
		map: '8p_angoville',
		mapName: 'Angoville (8)',
		matchType,
		type: MATCH_LABEL[scenario],
		players,
		teams: groupByTeam(players),
		me: { playerId: 1001, index: 0 }
	};
}

