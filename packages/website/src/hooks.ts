import type { Reroute } from '@sveltejs/kit';
import { parseLocaleFromPath } from '@company-of-heroes/i18n';

export const reroute: Reroute = ({ url }) => {
	const { locale, path, prefixed } = parseLocaleFromPath(url.pathname);
	if (prefixed && locale !== 'en' && path !== url.pathname) {
		return path;
	}
};
