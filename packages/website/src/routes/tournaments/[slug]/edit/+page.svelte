<script lang="ts">
	import { TournamentForm } from '@company-of-heroes/ui/tournament';
	import { flushHeader, flushSectionTitle } from '@company-of-heroes/ui/variants';
	import Seo from '$lib/components/seo/seo.svelte';
	import { useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<Seo title={t('Edit tournament')} noindex />

<div class={flushHeader}>
	<h1 class={flushSectionTitle}>{t('Edit tournament')}: {data.tournament.name}</h1>
</div>
<TournamentForm tournament={data.tournament} />
