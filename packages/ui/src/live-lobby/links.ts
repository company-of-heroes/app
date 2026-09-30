import type { TranslateFn } from '@company-of-heroes/i18n';
import type { HostRoutes } from '../host/host.context';
import { isCpuLiveLobbyPlayer, type LiveLobbyPlayer } from './types';

/** Profile link for a lobby slot; CPU / empty slots have none. */
export function liveLobbyPlayerHref(player: LiveLobbyPlayer, routes: HostRoutes): string | null {
	if (player.playerId === -1) {
		return null;
	}

	if (player.profileId) {
		return routes.player(player.profileId);
	}

	return player.steamId ? routes.player(player.steamId) : null;
}

/** Display name for a lobby slot, with translated CPU / unknown fallbacks. */
export function liveLobbyPlayerLabel(player: LiveLobbyPlayer, t: TranslateFn): string {
	const alias = player.alias.trim();
	if (isCpuLiveLobbyPlayer(player)) {
		return alias && /^cpu(\b|\s*[-–—])/i.test(alias) ? alias : t('CPU opponent');
	}

	return alias || t('Player {n}', { n: player.index + 1 });
}
