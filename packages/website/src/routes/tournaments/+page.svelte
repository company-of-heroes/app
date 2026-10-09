<script lang="ts">
	import { TournamentOverview } from '@company-of-heroes/ui/tournament';
	import { href, useI18n } from '$lib/i18n';
	import { SITE_URL } from '$lib/site/urls';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<svelte:head>
	<title>{t('Tournaments')} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={t(
			'Company of Heroes 1v1 tournaments: sign up, follow the brackets and see past winners.'
		)}
	/>
	<meta property="og:url" content="{SITE_URL}{href('/tournaments')}" />
	<meta property="og:title" content={t('Tournaments')} />
</svelte:head>

<TournamentOverview active={data.active} upcoming={data.upcoming} past={data.past} />
