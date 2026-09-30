import type { HostContext } from '../host/host.context';
import { normalizeMapName } from '../format/player-format';
import type { CommunityPlayer } from './types';

/** Profile link for a match roster entry; CPU slots have none. */
export function communityPlayerHref(
	player: CommunityPlayer,
	routes: HostContext['routes']
): string | null {
	if (player.playerId === -1) {
		return null;
	}

	if (player.steamId) {
		return routes.player(player.steamId);
	}

	return player.profile.profile_id > 0 ? routes.player(player.profile.profile_id) : null;
}

/** Detail page of a community match or member replay. */
export function replayDetailHref(
	match: { id: string; kind?: 'match' | 'member' },
	routes: HostContext['routes']
): string {
	return match.kind === 'member' ? routes.memberReplay(match.id) : routes.match(match.id);
}

/** Map names from replays may be `$123` game-string ids; the desktop can resolve those. */
export function displayMapName(map: string, host: HostContext): string {
	if (/^\$\d+$/.test(map)) {
		return host.resolve.gameString?.(map) || normalizeMapName(map);
	}

	return normalizeMapName(map);
}
