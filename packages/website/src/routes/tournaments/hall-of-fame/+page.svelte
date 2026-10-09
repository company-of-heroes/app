<script lang="ts">
	import { TournamentHallOfFame } from '@company-of-heroes/ui/tournament';
	import { href, useI18n } from '$lib/i18n';
	import { SITE_URL } from '$lib/site/urls';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<svelte:head>
	<title>{t('Hall of fame')} | {t('Tournaments')} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={t(
			'Every Company of Heroes 1v1 tournament champion and the players with the most titles.'
		)}
	/>
	<meta property="og:url" content="{SITE_URL}{href('/tournaments/hall-of-fame')}" />
	<meta property="og:title" content={t('Hall of fame')} />
</svelte:head>

<TournamentHallOfFame initial={data.hallOfFame} />
