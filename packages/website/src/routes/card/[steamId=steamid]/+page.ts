import { redirect } from '@sveltejs/kit';
import { localizeHref, parseLocaleFromPath } from '@company-of-heroes/i18n';
import type { PageLoad } from './$types';

export const prerender = false;

export const load: PageLoad = ({ params, url }) => {
	redirect(
		301,
		localizeHref(`/players/${params.steamId}`, parseLocaleFromPath(url.pathname).locale)
	);
};
