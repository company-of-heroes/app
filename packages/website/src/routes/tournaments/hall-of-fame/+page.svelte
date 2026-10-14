<script lang="ts">
	import { TournamentHallOfFame } from '@company-of-heroes/ui/tournament';
	import Seo from '$lib/components/seo/seo.svelte';
	import { useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<Seo
	title="{t('Hall of fame')} | {t('Tournaments')}"
	ogTitle={t('Hall of fame')}
	description={t(
		'Every Company of Heroes 1v1 tournament champion and the players with the most titles.'
	)}
/>

<TournamentHallOfFame initial={data.hallOfFame} />
