import type { LobbyPlayer } from '@fknoobs/app';
import { groupBy } from 'lodash-es';

export const MATCH_TYPES = {
	0: 'Basic Match',
	1: '1 VS. 1',
	2: '2 VS. 2',
	3: '3 VS. 3',
	4: '4 VS. 4',
	5: '2 VS. 2 AT',
	6: '3 VS. 3 AT',
	7: '4 VS. 4 AT',
	8: 'Operation: Assault 2v2',
	9: 'Operation: Assault 2v2 AT',
	10: 'Operation: Assault 3v3 AT',
	11: 'Operation: Panzerkrieg 2v2',
	12: 'Operation: Panzerkrieg 2v2 AT',
	13: 'Operation: Panzerkrieg 3v3 AT',
	14: 'Skirmish',
	15: 'Operation: Assault',
	16: 'Operation: Panzerkrieg',
	17: 'Operation: Stonewall'
} as const;

export type MatchTypeId = keyof typeof MATCH_TYPES;

export type Match = {
	sessionId: number;
	startedAt: string;
	map: string;
	players: LobbyPlayer[];
	teams: { teamId: number; players: LobbyPlayer[] }[];
	outcome?: string;
	didNotify: boolean;
	started: boolean;
	isRanked: boolean;
	outcomeFormatted: string;
	matchType: MatchTypeId;
	isSkirmish: boolean;
	type: string;
	mapName: string;
	me?: LobbyPlayer;
};

/**
 * Represents a Company of Heroes lobby/match session built up from log events.
 *
 * Pure domain model: it has no dependency on the app context. The local
 * player's Steam ID is injected by the log session so `me` can be resolved.
 */
export class Lobby {
	sessionId: number | null = null;
	startedAt: string | null = null;
	map?: string;
	players: LobbyPlayer[] = [];
	outcome?: string;
	didNotify = false;
	started = false;
	isRanked = false;

	/** Steam ID of the local player, injected by the log session. */
	localSteamId: string | undefined;

	constructor(startedAt: string, isRanked: boolean) {
		this.startedAt = startedAt;
		this.isRanked = isRanked;
	}

	get outcomeFormatted(): string {
		if (!this.outcome) return 'Unknown';

		switch (this.outcome) {
			case 'PS_WON':
				return 'Won';
			case 'PS_LOST':
				return 'Lost';
			case 'PS_ABORTED':
				return 'Aborted';
			default:
				return 'Unknown';
		}
	}

	get matchType(): MatchTypeId {
		if (this.isSkirmish) {
			return 14;
		}

		if (!this.isRanked) {
			return 0;
		}

		if (this.players.length === 2) {
			return 1;
		}

		if (this.players.length === 4) {
			return 2;
		}

		if (this.players.length === 6) {
			return 3;
		}

		if (this.players.length === 8) {
			return 4;
		}

		return 0;
	}

	get isSkirmish(): boolean {
		return this.teams.some((team) => team.players.every((player) => player.playerId === -1));
	}

	get teams() {
		return Object.entries(groupBy(this.players, 'team')).map(([teamId, players]) => ({
			teamId: Number(teamId),
			players
		}));
	}

	get type(): string {
		return MATCH_TYPES[this.matchType] ?? 'Custom Game';
	}

	get mapName(): string {
		if (!this.map) return 'Unknown Map';

		const match = this.map.match(/^(\d+)p_(.+)$/);
		if (!match) {
			return this.map.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
		}

		const [, playerCount, mapNameWithoutPrefix] = match;
		const formattedName = mapNameWithoutPrefix
			.replace(/_/g, ' ')
			.replace(/\b\w/g, (c) => c.toUpperCase());

		return `${formattedName} (${playerCount})`;
	}

	/** The local player, resolved via the injected Steam ID. */
	get me(): LobbyPlayer | undefined {
		if (!this.players?.length || !this.localSteamId) {
			return undefined;
		}

		return (
			this.players.find((p) => p.steamId === this.localSteamId) ??
			this.players.find((p) => p.profile?.name?.endsWith(this.localSteamId!))
		);
	}

	addPlayer(player: LobbyPlayer) {
		if (this.players.some((p) => p.index === player.index)) {
			return;
		}

		this.players.push(player);
	}

	/**
	 * Retrieves a player by their lobby slot number. The game assigns slots
	 * in team-interleaved order, hence the per-size mappings.
	 */
	getPlayerBySlot(slot: number): LobbyPlayer | null {
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

		return this.players.find((player) => player.index === index) ?? null;
	}

	/** Player IDs excluding CPU players. */
	getPlayerIds(): number[] {
		return this.players.map((player) => player.playerId).filter((id) => id !== -1);
	}

	getPlayerById(playerId: number): LobbyPlayer | undefined {
		return this.players.find((player) => player.playerId === playerId);
	}

	toJSON(): Match {
		return {
			sessionId: this.sessionId!,
			startedAt: this.startedAt!,
			map: this.map!,
			players: this.players,
			teams: this.teams,
			outcome: this.outcome,
			didNotify: this.didNotify,
			started: this.started,
			isRanked: this.isRanked,
			outcomeFormatted: this.outcomeFormatted,
			matchType: this.matchType,
			isSkirmish: this.isSkirmish,
			type: this.type,
			mapName: this.mapName,
			me: this.me
		};
	}
}
