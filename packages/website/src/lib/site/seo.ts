import { SITE_URL } from '$lib/site/urls';

type Crumb = { name: string; href: string };

/** Open Graph locale tags per site locale. */
export const OG_LOCALES: Record<string, string> = {
	en: 'en_US',
	es: 'es_ES',
	ko: 'ko_KR'
};

/** schema.org BreadcrumbList for a page; `href` is the localized site path. */
export function breadcrumbList(crumbs: Crumb[]): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: crumbs.map((crumb, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: crumb.name,
			item: `${SITE_URL}${crumb.href}`
		}))
	};
}

/** The site as a schema.org Organization, for publisher / organizer fields. */
export const organization = {
	'@type': 'Organization',
	name: 'COH1 Stats',
	alternateName: ['CoH Stats', 'coh1stats'],
	url: SITE_URL,
	logo: `${SITE_URL}/apple-touch-icon.png`
};
