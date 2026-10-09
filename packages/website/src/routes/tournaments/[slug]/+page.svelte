<script lang="ts">
	import { TournamentPage } from '@company-of-heroes/ui/tournament';
	import { href, useI18n } from '$lib/i18n';
	import { SITE_URL } from '$lib/site/urls';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const tournament = $derived(data.detail.tournament);
</script>

<svelte:head>
	<title>{tournament.name} | {t('Tournaments')} | {t('Company of Heroes 1 Stats')}</title>
	<meta
		name="description"
		content={tournament.description.slice(0, 160) ||
			t('Company of Heroes 1v1 tournaments: sign up, follow the brackets and see past winners.')}
	/>
	<meta property="og:url" content="{SITE_URL}{href(`/tournaments/${tournament.slug}`)}" />
	<meta property="og:title" content={tournament.name} />
</svelte:head>

<!-- Keyed: another tournament starts with fresh tabs, dialogs and sign-up state. -->
{#key tournament.id}
	<TournamentPage detail={data.detail} />
{/key}
