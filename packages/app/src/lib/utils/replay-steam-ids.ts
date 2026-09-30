import { embedPlayerSteamIds } from '@fknoobs/replay-parser';

type ResultPlayer = {
	alias?: string | null;
	steamId?: string | null;
};

/** Builds a name → Steam ID map from Relic result players (alias keys). */
export function steamIdsByAliasFromResultPlayers(
	players: ResultPlayer[] | null | undefined
): Record<string, string> {
	const map: Record<string, string> = {};
	if (!players?.length) {
		return map;
	}

	for (const player of players) {
		const alias = player.alias?.trim();
		const steamId = player.steamId?.trim();
		if (alias && steamId) {
			map[alias] = steamId;
		}
	}

	return map;
}

/** Embeds Steam IDs from result players into replay bytes (FKSTMETA trailer). */
export function embedSteamIdsInReplay(
	bytes: Uint8Array,
	players: ResultPlayer[] | null | undefined
): Uint8Array {
	return embedPlayerSteamIds(bytes, steamIdsByAliasFromResultPlayers(players));
}
