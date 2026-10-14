<script lang="ts">
	import CardForm from '$lib/components/player/card-form.svelte';
	import { PlayerSearchResults } from '@company-of-heroes/ui/player';
	import { Alert } from '@company-of-heroes/ui/alert';
	import Seo from '$lib/components/seo/seo.svelte';
	import { useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<Seo
	title={t('Players')}
	ogTitle={t('CoH Player Stats')}
	description={t('Look up Company of Heroes player stats by name, Steam ID, or Relic profile id.')}
/>

<CardForm initialQuery={data.query} class="py-2" />

{#if data.error}
	<div class="border-secondary-800 border-b px-4 py-3">
		<Alert variant="destructive">{t(data.error)}</Alert>
	</div>
{:else if data.query}
	{#key data.query}
		<PlayerSearchResults query={data.query} initial={data.page} />
	{/key}
{/if}
