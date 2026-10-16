import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user ?? null;
	const [list, status] = await Promise.all([
		unwrapAsync(locals.services.subscriptions.list()),
		user ? unwrapAsync(locals.services.subscriptions.status(user.id)) : null
	]);
	return {
		list,
		status,
		welcome: url.searchParams.get('welcome') === '1',
		checkout: url.searchParams.get('checkout') === '1'
	};
};
