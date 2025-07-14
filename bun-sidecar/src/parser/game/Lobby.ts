import { Events } from '../Events.js';
import type { ILobby, IPlayer, LobbyEvents } from '../types.js';
import { Map } from './Map.js';

export default class Lobby extends Events<LobbyEvents> implements ILobby {
	id: number = 0;
	populating: boolean = false;
	playerCount: number = 0;
	players: IPlayer[] = [];
	map = new Map();

	getPlayerById(playerId: number) {
		return this.players.find((p) => p.playerId === playerId);
	}

	getPlayerBySlot(slot: number) {
		return this.players.find((p) => p.slot === slot);
	}
}

export const lobby = new Lobby();
