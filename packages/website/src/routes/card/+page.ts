import { redirect } from '@sveltejs/kit';
import { localizeHref, parseLocaleFromPath } from '@company-of-heroes/i18n';

export const prerender = false;

export function load({ url }: { url: URL }) {
	redirect(301, localizeHref('/players', parseLocaleFromPath(url.pathname).locale));
}
