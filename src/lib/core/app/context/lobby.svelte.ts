import type { LobbyPlayer } from '@fknoobs/app';
import { groupBy } from 'lodash-es';
import { MATCH_TYPES, type MatchTypeId } from '$lib/utils/game';
import { app } from '$core/app/context';

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
	me: LobbyPlayer;
};

/**
 * Represents a Company of Heroes lobby instance.
 * Manages lobby state, player information, match details, and ranking data.
 */
export class Lobby {
	/**
	 * Unique session ID for the lobby.
	 */
	sessionId: number | null = null;

	/**
	 * Started timestamp of the lobby.
	 */
	startedAt: string | null = null;

	/**
	 * Current map name for the lobby.
	 */
	map?: string;

	/**
	 * Array of players currently in the lobby.
	 */
	players: LobbyPlayer[] = [];

	/**
	 * Match outcome when the game ends.
	 */
	outcome?: string;

	/**
	 * Flag indicating whether a notification has been sent for this lobby.
	 */
	didNotify = false;

	/**
	 * Flag indicating whether the match has started.
	 */
	started = false;

	/**
	 * Flag indicating whether this is a ranked match.
	 */
	isRanked = false;

	/**
	 * Derived state providing a human-readable outcome string.
	 */
	get outcomeFormatted() {
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

	/**
	 * Numeric identifier for the match type.
	 */
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
		const hasCpuPlayers = this.teams.some((team) =>
			team.players.every((player) => player.playerId === -1)
		);

		return hasCpuPlayers;
	}

	/**
	 * Derived state organizing players into teams.
	 */
	get teams() {
		return Object.entries(groupBy(this.players, 'team')).map(([teamId, players]) => ({
			teamId: Number(teamId),
			players
		}));
	}

	/**
	 * Derived state providing human-readable match type name.
	 */
	get type() {
		return MATCH_TYPES[this.matchType as MatchTypeId] ?? 'Custom Game';
	}

	/**
	 * Derived state providing formatted map name with player count.
	 */
	get mapName() {
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

	/**
	 * Derived state to find the current player in the lobby.
	 */
	get me() {
		if (!this.players || this.players.length === 0) return undefined;

		return this.players.find((p) => p.profile?.name?.endsWith(app.game.steamId!));
	}

	constructor(startedAt: string, isRanked: boolean) {
		this.startedAt = startedAt;
		this.isRanked = isRanked;
	}

	/**
	 * Adds a new player to the lobby.
	 */
	addPlayer(player: LobbyPlayer) {
		if (this.players.some((p) => p.index === player.index)) {
			return;
		}

		this.players.push(player);
	}

	/**
	 * Retrieves a player by their slot number.
	 */
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

	/**
	 * Returns an array of player IDs in the lobby.
	 */
	getPlayerIds(): number[] {
		return this.players.map((player) => player.playerId).filter((id) => id !== -1);
	}

	/**
	 * Retrieves a player by their profile ID.
	 */
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
			me: this.me!
		};
	}
}
