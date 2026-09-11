import PocketBase from 'pocketbase';
import type { RequestEvent } from '@sveltejs/kit';
import { serializeAuthUser } from '$lib/auth/user';
import { createServices } from '$lib/services/create-services';
import { API_URL } from '$lib/site/urls';

export function createPocketBase(event: RequestEvent): PocketBase {
	const pocketbase = new PocketBase(API_URL);
	pocketbase.beforeSend = (url, options) => ({
		url,
		options: { ...options, fetch: options.fetch ?? event.fetch }
	});
	pocketbase.authStore.loadFromCookie(event.request.headers.get('cookie') ?? '');
	return pocketbase;
}

export function syncLocalsUser(event: RequestEvent) {
	const pocketbase = event.locals.pocketbase;
	event.locals.user = pocketbase.authStore.isValid
		? serializeAuthUser(pocketbase, pocketbase.authStore.record)
		: null;
}

export function boot(event: RequestEvent) {
	event.locals.pocketbase = createPocketBase(event);
	event.locals.services = createServices({
		pocketbase: event.locals.pocketbase,
		fetch: event.fetch
	});
}
