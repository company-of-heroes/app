<script lang="ts">
	import { DocsWeaponPage } from '@company-of-heroes/ui/docs';
	import { href, useI18n } from '$lib/i18n';
	import { SITE_URL } from '$lib/site/urls';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const page = $derived(data.page);
	const description = $derived(
		t('Damage, accuracy, range and penetration of the {name}.', { name: page.weapon.name })
	);
</script>

<svelte:head>
	<title>{page.weapon.name} | {t('Unit documentation')} | {t('Company of Heroes 1 Stats')}</title>
	{#if description}
		<meta name="description" content={description} />
	{/if}
	<meta property="og:url" content="{SITE_URL}{href(`/docs/weapons/${page.weapon.slug}`)}" />
	<meta property="og:title" content={page.weapon.name} />
</svelte:head>

<DocsWeaponPage {page} />
