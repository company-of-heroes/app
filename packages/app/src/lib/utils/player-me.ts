import { app } from '$core/app/context';
import { isValidSteamId } from '$lib/utils/player-elo';

type MePlayerLike = {
	steamId?: string | null;
	profile_id?: number | null;
	playerId?: number | null;
	profile?: {
		profile_id?: number | null;
		name?: string | null;
	} | null;
	name?: string | null;
};

export function getMeSteamIds(): string[] {
	return app.features.auth.user?.steamIds ?? [];
}

export function getMeProfileId(): number | undefined {
	return app.game.profile?.relic.profile_id;
}

function steamIdFromName(name?: string | null): string | undefined {
	if (typeof name !== 'string' || !name.startsWith('/steam/')) {
		return undefined;
	}

	const steamId = name.slice('/steam/'.length);
	return isValidSteamId(steamId) ? steamId : undefined;
}

function profileIdFromPlayer(player: MePlayerLike): number | undefined {
	const profileId = player.profile_id ?? player.profile?.profile_id ?? player.playerId ?? undefined;
	return profileId != null && profileId > 0 ? profileId : undefined;
}

function steamIdFromPlayer(player: MePlayerLike): string | undefined {
	if (player.steamId && isValidSteamId(player.steamId)) {
		return player.steamId;
	}

	return steamIdFromName(player.name ?? player.profile?.name);
}

/** True when the player is the logged-in user (Steam IDs or active Relic profile). */
export function isMePlayer(player: MePlayerLike): boolean {
	const steamId = steamIdFromPlayer(player);
	if (steamId && getMeSteamIds().includes(steamId)) {
		return true;
	}

	const profileId = profileIdFromPlayer(player);
	const meProfileId = getMeProfileId();
	if (profileId != null && meProfileId != null && profileId === meProfileId) {
		return true;
	}

	return false;
}

/** Replay files only store in-game aliases — match against the active Relic alias. */
export function isMeReplayAlias(name: string): boolean {
	const normalized = name.trim().toLowerCase();
	if (!normalized) {
		return false;
	}

	const alias = app.game.profile?.relic.alias?.trim().toLowerCase();
	if (alias && normalized === alias) {
		return true;
	}

	const accountName = app.features.auth.user?.name?.trim().toLowerCase();
	if (accountName && normalized === accountName) {
		return true;
	}

	return false;
}
