import type { RequestEvent } from '@sveltejs/kit';
import { createApi } from '@company-of-heroes/api';
import { serializeAuthUser } from '$lib/auth/user';
import { createUserPocketBase } from '$lib/server/pb';
import { Services } from '$lib/server/services';
import { API_URL } from '$lib/site/urls';

export function syncLocalsUser(event: RequestEvent) {
	const pocketbase = event.locals.pocketbase;
	event.locals.user = pocketbase.authStore.isValid
		? serializeAuthUser(pocketbase, pocketbase.authStore.record)
		: null;
}

export function boot(event: RequestEvent) {
	const pocketbase = createUserPocketBase(event.request, event.fetch);
	event.locals.pocketbase = pocketbase;
	// The shared client, acting as the signed-in user (account, profile customization).
	event.locals.api = createApi({
		pocketbase,
		fetch: event.fetch,
		baseUrl: API_URL,
		siteUrl: event.url.origin,
		userId: () => pocketbase.authStore.record?.id ?? ''
	});
	event.locals.services = new Services(event.locals, {
		fetch: event.fetch,
		overlays: event.platform?.env?.OVERLAYS
	});
}
