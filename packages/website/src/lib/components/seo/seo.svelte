<script lang="ts">
	import { building } from '$app/environment';
	import { page } from '$app/state';
	import { useI18n } from '$lib/i18n';
	import { OG_LOCALES } from '$lib/site/seo';
	import { SITE_URL } from '$lib/site/urls';

	type Props = {
		/** Page title without the site suffix. */
		title: string;
		description?: string;
		/** Open Graph / Twitter title; defaults to `title`. */
		ogTitle?: string;
		/** Share image: absolute URL or site path. Defaults to the site card. */
		image?: string;
		/** Open Graph URL; defaults to the current page URL. */
		url?: string;
		type?: 'website' | 'article' | 'profile' | 'video.other';
		/** Keep the page out of search results (account, auth, redirect and editor pages). */
		noindex?: boolean;
		/** schema.org objects, rendered as JSON-LD. */
		jsonLd?: Record<string, unknown> | Record<string, unknown>[];
		/** Append " | Company of Heroes 1 Stats" to the title. */
		suffix?: boolean;
		/**
		 * Pages that exist only in some languages (guides) set their own canonical and hreflang
		 * tags here, as localized site paths; the root layout then leaves them out.
		 */
		canonicalPath?: string;
		alternates?: { locale: string; path: string }[];
		/** `article:*` tags, for `type="article"`. */
		article?: { publishedTime: string; modifiedTime?: string; author?: string; section?: string };
	};

	let {
		title,
		description,
		ogTitle,
		image,
		url: ogUrl,
		type = 'website',
		noindex = false,
		jsonLd,
		suffix = true,
		canonicalPath,
		alternates,
		article
	}: Props = $props();
	const { t } = useI18n();

	const fullTitle = $derived(suffix ? `${title} | ${t('Company of Heroes 1 Stats')}` : title);
	const shareTitle = $derived(ogTitle ?? title);
	const url = $derived(
		ogUrl ??
			(canonicalPath
				? absolute(canonicalPath)
				: `${SITE_URL}${page.url.pathname}${building ? '' : page.url.search}`)
	);
	const imageUrl = $derived(absolute(image || '/og-image.png'));
	// `<` is escaped so user content (aliases, descriptions) cannot close the script tag.
	const jsonLdText = $derived(jsonLd ? JSON.stringify(jsonLd).replaceAll('<', '\\u003c') : '');
	const locale = $derived(page.data.locale ?? 'en');
	/** The English version when there is one, else the canonical page. */
	const xDefault = $derived(
		alternates?.find((alternate) => alternate.locale === 'en')?.path ?? canonicalPath
	);

	function absolute(src: string) {
		return src.startsWith('http') ? src : `${SITE_URL}${src}`;
	}
</script>

<svelte:head>
	<title>{fullTitle}</title>
	{#if description}
		<meta name="description" content={description} />
	{/if}
	{#if noindex}
		<meta name="robots" content="noindex, nofollow" />
	{/if}
	{#if canonicalPath}
		<link rel="canonical" href={absolute(canonicalPath)} />
		{#each alternates ?? [] as alternate (alternate.locale)}
			<link rel="alternate" hreflang={alternate.locale} href={absolute(alternate.path)} />
		{/each}
		{#if xDefault}
			<link rel="alternate" hreflang="x-default" href={absolute(xDefault)} />
		{/if}
		<meta property="og:locale" content={OG_LOCALES[locale] ?? OG_LOCALES.en} />
		{#each (alternates ?? []).filter((alternate) => alternate.locale !== locale) as alternate (alternate.locale)}
			<meta
				property="og:locale:alternate"
				content={OG_LOCALES[alternate.locale] ?? alternate.locale}
			/>
		{/each}
	{/if}
	<meta property="og:type" content={type} />
	<meta property="og:url" content={url} />
	<meta property="og:title" content={shareTitle} />
	{#if description}
		<meta property="og:description" content={description} />
	{/if}
	<meta property="og:image" content={imageUrl} />
	{#if type === 'article' && article}
		<meta property="article:published_time" content={article.publishedTime} />
		{#if article.modifiedTime}
			<meta property="article:modified_time" content={article.modifiedTime} />
		{/if}
		{#if article.author}
			<meta property="article:author" content={article.author} />
		{/if}
		{#if article.section}
			<meta property="article:section" content={article.section} />
		{/if}
	{/if}
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={shareTitle} />
	{#if description}
		<meta name="twitter:description" content={description} />
	{/if}
	<meta name="twitter:image" content={imageUrl} />
	{#if jsonLdText}
		{@html `<script type="application/ld+json">${jsonLdText}<\/script>`}
	{/if}
</svelte:head>
