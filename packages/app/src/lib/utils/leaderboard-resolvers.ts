import { getRankImageByLeaderboardId } from '$lib/utils';
import {
	getCountryDisplayName,
	getSteamIdFromProfile
} from '$lib/components/leaderboard/leaderboard-utils';

export { getRankImageByLeaderboardId, getCountryDisplayName, getSteamIdFromProfile };

export function getSteamIdFromName(name: string): string {
	return name.replace('/steam/', '');
}

export function playerHref(profileId: number): string {
	return `/players/${profileId}`;
}

export function flagImageUrl(country: string | null | undefined): string | null {
	if (!country) {
		return null;
	}

	const region = String(country).trim().toUpperCase();
	if (!/^[A-Z]{2}$/.test(region)) {
		return null;
	}

	return `https://flagsapi.com/${region}/shiny/64.png`;
}
