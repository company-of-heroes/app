import type { Map } from './game/Map';

export type Config = {
	pathToWarnings: string | null;
};

export type ILobby = {
	id: number;
	populating: boolean;
	playerCount: number;
	players: IPlayer[];
	map: Map;
};

export type IPlayer = {
	index: number;
	playerId: number;
	type: number;
	team: number;
	race: number;
	slot: number;
	steamId?: bigint;
	ranking?: number;
	result?: 'PS_WON' | 'PS_KILLED';
};

export type EventDefaultData = { line: string };
export type EventData<T = Record<string, any>> = T & EventDefaultData;

export type LogEvents = {
	'LOG:STARTED': () => void;
	'LOG:ENDED': () => void;
	'LOG:FOUND:PROFILE': (steamId: bigint) => void;
	'LOG:LOBBY:JOINED': () => void;
	'LOG:LOBBY:POPULATING': () => void;
	'LOG:LOBBY:POPULATING:MAP': (map: CoHMaps) => void;
	'LOG:LOBBY:POPULATING:PLAYER': (
		index: number,
		playerId: number,
		type: number,
		team: number,
		race: number
	) => void;
	'LOG:LOBBY:POPULATING:PLAYER:COUNT': (count: number) => void;
	'LOG:LOBBY:POPULATING:PLAYER:STEAM': (steamId: bigint, slot: number, ranking: number) => void;
	'LOG:LOBBY:POPULATING:MATCH:TYPE': (type: 'BASIC_MATCH' | 'SKRIMISH' | 'AUTOMATCH') => void;
	'LOG:LOBBY:POPULATING:COMPLETE': () => void;
	'LOG:LOBBY:PLAYER:RESULT': (playerId: number, result: 'PS_WON' | 'PS_KILLED') => void;
	'LOG:LOBBY:GAMEOVER': () => void;
	'LOG:LOBBY:DESTROYED': () => void;
	'LOG:LOBBY:STARTED': () => void;
};

export type LobbyPopulatedSteamId = (steamId: bigint) => void;
export type LobbyPopulatedPlayerCount = (playerCount: number) => void;
export type LobbyPopulatedPlayer = (player: IPlayer) => void;
export type LobbyPopulatedMap = (map: string) => void;

export type LobbyEvents = {
	'LOBBY:STARTED': (lobby: ILobby) => void;
	'LOBBY:POPULATED:PLAYER': LobbyPopulatedPlayer;
	'LOBBY:POPULATED:STEAM': LobbyPopulatedSteamId;
	'LOBBY:POPULATED:MAP': LobbyPopulatedMap;
	'LOBBY:POPULATED:PLAYERCOUNT': LobbyPopulatedPlayerCount;
	'LOBBY:GAMEOVER': (lobby: ILobby) => void;
};

export type CoHEvents = {
	'GAME:STARTED': () => void;
	'GAME:CLOSED': () => void;
	'GAME:USER': (steamId: bigint) => void;
	'GAME:WON': (lobby: ILobby) => void;
	'GAME:LOST': (lobby: ILobby) => void;
};

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
