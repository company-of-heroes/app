import { SITE_URL } from '$lib/site/urls';
import type { GuideSitemapEntry } from '$lib/server/services/guides';
import type { RequestHandler } from './$types';

export const prerender = false;

const LOCALES = ['es', 'ko'] as const;

const PAGES: { path: string; changefreq: string }[] = [
	{ path: '/', changefreq: 'hourly' },
	{ path: '/players', changefreq: 'daily' },
	{ path: '/leaderboards', changefreq: 'hourly' },
	{ path: '/stats', changefreq: 'daily' },
	{ path: '/replays', changefreq: 'hourly' },
	{ path: '/tournaments', changefreq: 'daily' },
	{ path: '/tournaments/hall-of-fame', changefreq: 'weekly' },
	{ path: '/guides', changefreq: 'daily' },
	{ path: '/wiki', changefreq: 'weekly' },
	{ path: '/wiki/weapons', changefreq: 'weekly' },
	{ path: '/wiki/rewards', changefreq: 'monthly' },
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

/** A guide: its own locale's URL with only the translations it really has. */
function guideEntry(guide: GuideSitemapEntry): string {
	const locale = (code: string) => (code === 'en' ? undefined : code);
	const links = guide.alternates
		.map(
			(alternate) =>
				`<xhtml:link rel="alternate" hreflang="${alternate.locale}" href="${localeUrl(alternate.path, locale(alternate.locale))}" />`
		)
		.join('');
	return `<url><loc>${localeUrl(guide.path, locale(guide.language))}</loc>${lastmod(guide.lastmod)}<changefreq>weekly</changefreq>${links}</url>`;
}

function lastmod(value: string): string {
	const date = new Date(value.replace(' ', 'T'));
	return Number.isNaN(date.getTime())
		? ''
		: `<lastmod>${date.toISOString().slice(0, 10)}</lastmod>`;
}

/**
 * Static pages in every locale, docs pages, guide categories (every locale) and guides (their
 * own language plus real translations), public tournaments, ladder players and the newest
 * public replays (English URL with alternates).
 */
export const GET: RequestHandler = async ({ locals }) => {
	const [replays, docs, tournaments, players, guideCategories, guides] = await Promise.all([
		locals.services.replays.sitemapEntries().unwrapOr([]),
		locals.services.docs.paths().unwrapOr([]),
		locals.services.tournaments.sitemapEntries().unwrapOr([]),
		locals.services.leaderboard.sitemapSteamIds().unwrapOr([]),
		locals.services.guides.categoryPaths().unwrapOr([]),
		locals.services.guides.sitemapEntries().unwrapOr([])
	]);
	const urls = [
		...PAGES.flatMap(({ path, changefreq }) =>
			[undefined, ...LOCALES].map((locale) =>
				entry(localeUrl(path, locale), path, `<changefreq>${changefreq}</changefreq>`)
			)
		),
		...docs.map((path) => entry(localeUrl(path), path, '<changefreq>monthly</changefreq>')),
		...guideCategories.flatMap((path) =>
			[undefined, ...LOCALES].map((locale) =>
				entry(localeUrl(path, locale), path, '<changefreq>weekly</changefreq>')
			)
		),
		...guides.map(guideEntry),
		...tournaments.map((tournament) => {
			const path = `/tournaments/${encodeURIComponent(tournament.slug)}`;
			return entry(localeUrl(path), path, lastmod(tournament.updated));
		}),
		...players.map((steamId) => {
			const path = `/players/${steamId}`;
			return entry(localeUrl(path), path, '<changefreq>daily</changefreq>');
		}),
		...replays.map((replay) => {
			const path = `/replays/${encodeURIComponent(replay.id)}`;
			return entry(localeUrl(path), path, lastmod(replay.createdAt));
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
