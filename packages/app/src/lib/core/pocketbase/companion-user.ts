import { api, unwrapApi } from '$core/api';
import { readMetaVersion, type CompanionUser } from '@company-of-heroes/api';
import type { UsersResponse } from '$core/pocketbase/types';

export { readMetaVersion };
export type { CompanionUser };

export async function findCompanionUserBySteamId(steamId: string): Promise<UsersResponse | null> {
	const user = await unwrapApi(api.companion.findCompanionUserBySteamId(steamId));
	return user as UsersResponse | null;
}
