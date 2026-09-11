<script lang="ts">
	import '@tt-mussels/style.css';
	import '../app.css';
	import Header from '$lib/components/layout/header.svelte';
	import Footer from '$lib/components/layout/footer.svelte';
	import I18nBoot from '$lib/components/i18n/i18n-boot.svelte';
	import pageBackgroundImage from '@assets/assets/art_ui_textures_textures_fe_bkg_cxp1.png';
	import { loadLatestDownload } from '$lib/site/download.svelte';
	import { pageShell } from '$lib/utils/variants';
	import { building } from '$app/environment';
	import { page } from '$app/state';
	import { SITE_URL } from '$lib/site/urls';
	import {
		locales,
		localizeHref,
		parseLocaleFromPath,
		unlocalizedPath,
		type AppLocale
	} from '$lib/i18n';
	import { onMount } from 'svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(() => {
		void loadLatestDownload();
	});

	const locale = $derived(parseLocaleFromPath(page.url.pathname).locale);
	const canonical = $derived(localizedUrl(locale));

	function localizedUrl(next: AppLocale) {
		const path = unlocalizedPath(page.url.pathname);
		const search = building ? '' : page.url.search;
		return `${SITE_URL}${localizeHref(path, next)}${search}`;
	}

	$effect(() => {
		document.documentElement.lang = locale;
	});
</script>

<svelte:head>
	<link rel="canonical" href={canonical} />
	{#each locales as locale (locale)}
		<link rel="alternate" hreflang={locale} href={localizedUrl(locale)} />
	{/each}
	<link rel="alternate" hreflang="x-default" href={localizedUrl('en')} />
</svelte:head>

<I18nBoot {locale}>
	<div class="min-h-screen font-sans">
		<div aria-hidden="true" class="pointer-events-none fixed inset-0">
			<div class="absolute inset-y-0 left-0 w-[max(0px,calc((100%-72rem)/2))] overflow-hidden">
				<img src={pageBackgroundImage} alt="" class="size-full object-cover object-left" />
				<div class="absolute inset-0 bg-gray-950/95 mix-blend-color"></div>
				<div class="absolute inset-0 bg-gray-950/85"></div>
			</div>
			<div class="absolute inset-y-0 right-0 w-[max(0px,calc((100%-72rem)/2))] overflow-hidden">
				<img src={pageBackgroundImage} alt="" class="size-full object-cover object-right" />
				<div class="absolute inset-0 bg-gray-950/95 mix-blend-color"></div>
				<div class="absolute inset-0 bg-gray-950/85"></div>
			</div>
		</div>
		<div class={pageShell}>
			<Header />
			<div class="flex-1">
				{@render children()}
			</div>
			<Footer />
		</div>
	</div>
</I18nBoot>
