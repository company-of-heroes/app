<script lang="ts">
	import { TournamentOverview } from '@company-of-heroes/ui/tournament';
	import Seo from '$lib/components/seo/seo.svelte';
	import { useI18n } from '$lib/i18n';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();
</script>

<Seo
	title={t('Tournaments')}
	description={t(
		'Company of Heroes 1v1 tournaments: sign up, follow the brackets and see past winners.'
	)}
/>

<TournamentOverview active={data.active} upcoming={data.upcoming} past={data.past} />
