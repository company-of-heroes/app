<script lang="ts">
	import { TournamentForm } from '@company-of-heroes/ui/tournament';
	import { flushHeader, flushSectionTitle } from '@company-of-heroes/ui/variants';
	import { useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<svelte:head>
	<title>{t('Edit tournament')} | {t('Company of Heroes 1 Stats')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class={flushHeader}>
	<h1 class={flushSectionTitle}>{t('Edit tournament')}: {data.tournament.name}</h1>
</div>
<TournamentForm tournament={data.tournament} />
