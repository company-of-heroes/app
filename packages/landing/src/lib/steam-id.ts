export const STEAM_ID_REGEX = /^7656119\d{10}$/;

export function isSteamId(value: string): boolean {
	return STEAM_ID_REGEX.test(value.trim());
}
