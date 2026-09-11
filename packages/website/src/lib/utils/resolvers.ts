import {
	countedActions,
	doctrineBannerUrl,
	playerCpm,
	playerHref,
	raceFromReplayFaction,
	type CommunityPlayer
} from '$lib/replays';
import { href, currentLocale } from '$lib/i18n';
import { getCountryDisplayName as countryDisplayName } from '$lib/utils/country';
import { getMapImageFromName } from '$lib/utils/media/maps';
import { flagImageUrl as flagImageUrlFromProxy, proxiedImageUrl } from '$lib/utils/media/proxy-image';
import {
	getFactionFlagByRace,
	getRankImageByLeaderboardId,
	getRankImageByRace
} from '$lib/utils/media/ranks';
import { normalizeMapName } from '$lib/utils/player/format';
import { getSteamIdFromName } from '$lib/utils/player/steam-id';

export function flagImageUrl(country: string | null | undefined): string | null {
	return flagImageUrlFromProxy(country ?? null);
}

export function getCountryDisplayName(country: string | null | undefined): string | null {
	return countryDisplayName(country, currentLocale());
}

export {
	getSteamIdFromName,
	getRankImageByLeaderboardId,
	getRankImageByRace,
	proxiedImageUrl,
	normalizeMapName,
	playerHref,
	countedActions,
	playerCpm,
	raceFromReplayFaction,
	doctrineBannerUrl
};

export function resolveMapSrc(map: string | undefined): string | undefined {
	return getMapImageFromName(map);
}

export function resolveFallbackSrc(): string | undefined {
	return getMapImageFromName(undefined);
}

export function resolveFactionFlag(race: number): string {
	return getFactionFlagByRace(race);
}

export function profileHref(profileId: number): string {
	return href(`/players/${profileId}`);
}

export function replayHref(matchId: string): string {
	return href(`/replays/${matchId}`);
}

export function smurfLenderHref(lenderProfileId: number | null, lenderSteamId: string): string {
	return href(`/players/${lenderProfileId ?? lenderSteamId}`);
}

export function resolveAvatarUrl(url: string): string {
	return proxiedImageUrl(url);
}

export function resolvePlayerHref(player: CommunityPlayer): string | null {
	const path = playerHref(player);
	return path ? href(path) : null;
}
