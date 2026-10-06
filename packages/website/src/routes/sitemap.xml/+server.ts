import { SITE_URL } from '$lib/site/urls';
import type { SitemapReplay } from '$lib/server/services/replays';
import type { RequestHandler } from './$types';

export const prerender = false;

const LOCALES = ['es', 'ko'] as const;

const PAGES: { path: string; changefreq: string }[] = [
	{ path: '/', changefreq: 'hourly' },
	{ path: '/players', changefreq: 'daily' },
	{ path: '/leaderboards', changefreq: 'hourly' },
	{ path: '/replays', changefreq: 'hourly' },
	{ path: '/docs', changefreq: 'weekly' },
	{ path: '/docs/weapons', changefreq: 'weekly' },
	{ path: '/privacy', changefreq: 'monthly' }
];

/** Absolute URL of `path` in a locale (English is unprefixed). */
function localeUrl(path: string, locale?: string): string {
	if (!locale) {
		return `${SITE_URL}${path}`;
	}

	return `${SITE_URL}/${locale}${path === '/' ? '' : path}`;
}

function alternates(path: string): string {
	return [
		`<xhtml:link rel="alternate" hreflang="en" href="${localeUrl(path)}" />`,
		...LOCALES.map(
			(locale) =>
				`<xhtml:link rel="alternate" hreflang="${locale}" href="${localeUrl(path, locale)}" />`
		),
		`<xhtml:link rel="alternate" hreflang="x-default" href="${localeUrl(path)}" />`
	].join('');
}

function entry(loc: string, path: string, extra: string): string {
	return `<url><loc>${loc}</loc>${extra}${alternates(path)}</url>`;
}

function lastmod(replay: SitemapReplay): string {
	const date = new Date(replay.createdAt.replace(' ', 'T'));
	return Number.isNaN(date.getTime())
		? ''
		: `<lastmod>${date.toISOString().slice(0, 10)}</lastmod>`;
}

/** Static pages in every locale, docs pages and the newest public replays (English URL with alternates). */
export const GET: RequestHandler = async ({ locals }) => {
	const replays = await locals.services.replays.sitemapEntries().unwrapOr([]);
	const docs = await locals.services.docs.paths().unwrapOr([]);
	const urls = [
		...PAGES.flatMap(({ path, changefreq }) =>
			[undefined, ...LOCALES].map((locale) =>
				entry(localeUrl(path, locale), path, `<changefreq>${changefreq}</changefreq>`)
			)
		),
		...docs.map((path) => entry(localeUrl(path), path, '<changefreq>monthly</changefreq>')),
		...replays.map((replay) => {
			const path = `/replays/${encodeURIComponent(replay.id)}`;
			return entry(localeUrl(path), path, lastmod(replay));
		})
	];
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>`;
	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
