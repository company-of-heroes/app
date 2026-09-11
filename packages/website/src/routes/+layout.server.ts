import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	return { user: locals.user, locale: locals.locale, pathname: url.pathname };
};
