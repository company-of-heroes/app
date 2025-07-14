import { RelicProfile } from '../types';

export type Player = {
	index: number;
	playerId: number;
	type: number;
	team: number;
	race: number;
	ranking?: number;
	steamId?: string;
	profile?: RelicProfile;
};

export class Lobby {
	private sessionId: number | null = null;
	private isStarted = false;
	private map: string | null = null;
	private players: Player[] = [];
	private outcome: 'PS_WON' | 'PS_KILLED' | null = null;
	private matchType: number = 0;

	addPlayer(player: Player) {
		if (this.players.some((p) => p.index === player.index)) {
			return;
		}

		this.players.push(player);
	}

	setSessionId(sessionId: number) {
		this.sessionId = sessionId;
	}

	getSessionId(): number | null {
		return this.sessionId;
	}

	setMatchType(type: number) {
		this.matchType = type;
	}

	setMap(map: string) {
		this.map = map;
	}

	setOutcome(outcome: 'PS_WON' | 'PS_KILLED') {
		this.outcome = outcome;
	}

	setIsStarted(started: boolean) {
		this.isStarted = started;
	}

	getIsStarted(): boolean {
		return this.isStarted;
	}

	getMap(): string | null {
		return this.map;
	}

	getPlayers(): Player[] {
		return this.players;
	}

	getPlayerIds(): number[] {
		return this.players.map((player) => player.playerId).filter((id) => id !== -1);
	}

	getOutcome(): 'PS_WON' | 'PS_KILLED' | null {
		return this.outcome;
	}

	getMatchType(): number {
		return this.matchType;
	}

	getPlayerBySlot(slot: number) {
		const mappings: Record<number, number[]> = {
			8: [0, 2, 4, 6, 1, 3, 5, 7],
			6: [0, 2, 4, 1, 3, 5],
			4: [0, 2, 1, 3],
			2: [0, 1]
		};

		const mapping = mappings[this.players.length];

		if (!mapping) {
			return null;
		}

		const index = mapping.indexOf(slot);

		if (index === -1) {
			return null;
		}

		return this.players.find((player) => player.index === index)!;
	}

	toJSON() {
		return {
			sessionId: this.sessionId,
			isStarted: this.isStarted,
			map: this.map,
			players: this.players,
			outcome: this.outcome,
			matchType: this.matchType
		};
	}
}
