import { localizeHref, type AppLocale } from '@company-of-heroes/i18n';
import type { Guide } from '@company-of-heroes/api/guides';
import { SITE_URL } from './urls';
import { organization } from './seo';

/**
 * Head data a page hands to `<Seo>` and the root layout: the layout then leaves canonical and
 * hreflang to the page, because a guide exists only in the languages it was written in.
 */
export type PageSeo = {
	/** Localized site path of the canonical URL. */
	canonicalPath: string;
	/** Every language the page exists in, as localized site paths. */
	alternates: { locale: AppLocale; path: string }[];
	noindex: boolean;
	article?: {
		publishedTime: string;
		modifiedTime: string;
		author: string;
		section?: string;
	};
};

export function guideSeo(guide: Guide): PageSeo | undefined {
	if (!guide.path) {
		return undefined;
	}

	const own = { locale: guide.language, path: localizeHref(guide.path, guide.language) };
	return {
		canonicalPath: own.path,
		alternates: [
			own,
			...guide.translations.map((translation) => ({
				locale: translation.language,
				path: localizeHref(translation.path, translation.language)
			}))
		],
		noindex: guide.noindex || guide.status !== 'published',
		article: {
			publishedTime: guide.publishedAt ?? guide.updated,
			modifiedTime: guide.updated,
			author: guide.author.name,
			section: guide.category?.name
		}
	};
}

/** schema.org Article for a published guide. */
export function guideJsonLd(guide: Guide, seo: PageSeo): Record<string, unknown> {
	return {
		'@context': 'https://schema.org',
		'@type': 'Article',
		headline: guide.seoTitle || guide.title,
		description: guide.seoDescription || guide.excerpt || undefined,
		image: guide.coverUrl ? [guide.coverUrl] : undefined,
		datePublished: seo.article?.publishedTime,
		dateModified: seo.article?.modifiedTime,
		author: {
			'@type': 'Person',
			name: guide.author.name,
			url: guide.author.steamId ? `${SITE_URL}/players/${guide.author.steamId}` : undefined
		},
		publisher: organization,
		mainEntityOfPage: `${SITE_URL}${seo.canonicalPath}`,
		inLanguage: guide.language,
		articleSection: guide.category?.name
	};
}
