import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user ?? null;
	// Best effort, like the account page: the page still renders when PocketBase fails here.
	const [list, status] = await Promise.all([
		unwrapAsync(locals.services.subscriptions.list()).catch((error) => {
			console.error('supporters list failed', error);
			return { current: [], former: [] };
		}),
		user
			? unwrapAsync(locals.services.subscriptions.status(user.id)).catch((error) => {
					console.error('supporter status failed', error);
					return null;
				})
			: null
	]);
	return {
		list,
		status,
		signedIn: !!user,
		checkout: url.searchParams.get('checkout') === '1'
	};
};
