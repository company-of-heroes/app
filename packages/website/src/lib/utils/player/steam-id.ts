export const STEAM_ID_REGEX = /^7656119\d{10}$/;
export const PROFILE_ID_REGEX = /^\d+$/;

export function isSteamId(value: string): boolean {
	return STEAM_ID_REGEX.test(value.trim());
}

export function isProfileId(value: string): boolean {
	const trimmed = value.trim();
	if (!PROFILE_ID_REGEX.test(trimmed) || isSteamId(trimmed)) {
		return false;
	}
	const id = Number(trimmed);
	return Number.isInteger(id) && id > 0;
}

export function isPlayerId(value: string): boolean {
	const trimmed = value.trim();
	return isSteamId(trimmed) || isProfileId(trimmed);
}

export function getSteamIdFromName(name: string): string {
	return name.replace('/steam/', '');
}
