export interface Player {
	name: string;
	faction: string;
	id: number;
	doctrine: number;
	team: number;
}

export interface Message {
	tick: number;
	playerName: string;
	playerId: number;
	text: string;
	recipient: number;
	timeStamp: string;
}

export interface Action {
    tick: number;
    playerId: number;
    playerName: string;
    timeStamp: string;
    rawHex: string;
}

export interface ParsedReplay {
    fileName: string;
    replayVersion: number;
    gameType: string;
    gameDate: string;
    modName: string;
    mapFileName: string;
    mapName: string;
    mapNameFormatted: string;
    replayName: string;
    matchType: string;
    highResources: boolean;
    randomStart: boolean;
    vpCount: number;
    vpGame: boolean;
    duration: number;
    players: Player[];
    messages: Message[];
    actions: Action[];
    playerCount: number;
    messageCount: number;
    actionCount: number;
}