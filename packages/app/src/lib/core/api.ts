import { createApi, sendV1, unwrapApi, type ApiDeps } from '@company-of-heroes/api';
import { pocketbase } from '$core/pocketbase';
import { fetch } from '$core/http/fetch';
import { PUBLIC_PB_URL } from '$env/static/public';
import { account } from '$core/account';
import { SITE_URL } from '$core/site/urls';

const deps: ApiDeps = {
	pocketbase,
	fetch,
	baseUrl: PUBLIC_PB_URL ?? 'https://api.coh1stats.com',
	// Everything but plain records goes to the website's API (local dev: the website dev server).
	siteUrl: SITE_URL,
	userId: () => pocketbase.authStore.record?.id ?? account.userId
};

export const api = createApi(deps);

/** A website API route (`/api/v1{path}`) with the signed-in user's token. */
export function siteApi<T>(path: string, options?: Parameters<typeof sendV1>[2]): Promise<T> {
	return sendV1<T>(deps, path, options);
}

export { unwrapApi };
