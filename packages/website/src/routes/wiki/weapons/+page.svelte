<script lang="ts">
	import { DocsWeaponList } from '@company-of-heroes/ui/docs';
	import { href, useI18n } from '$lib/i18n';
	import { SITE_URL } from '$lib/site/urls';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<svelte:head>
	<title>{t('Weapons')} | {t('Wiki')} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={t('Damage, accuracy, range and penetration of every Company of Heroes weapon.')}
	/>
	<meta property="og:url" content="{SITE_URL}{href('/wiki/weapons')}" />
	<meta property="og:title" content={t('CoH weapons')} />
</svelte:head>

<DocsWeaponList weapons={data.weapons} />
