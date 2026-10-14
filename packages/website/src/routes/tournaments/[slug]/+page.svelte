<script lang="ts">
	import { TournamentPage } from '@company-of-heroes/ui/tournament';
	import Seo from '$lib/components/seo/seo.svelte';
	import { href, useI18n } from '$lib/i18n';
	import { SITE_URL } from '$lib/site/urls';
	import { organization } from '$lib/site/seo';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { t } = useI18n();

	const tournament = $derived(data.detail.tournament);
	const description = $derived(
		tournament.description.slice(0, 160) ||
			t('Company of Heroes 1v1 tournaments: sign up, follow the brackets and see past winners.')
	);
	const url = $derived(`${SITE_URL}${href(`/tournaments/${tournament.slug}`)}`);
	const jsonLd = $derived.by(() => {
		if (!tournament.startsAt) {
			return undefined;
		}

		return {
			'@context': 'https://schema.org',
			'@type': 'Event',
			name: tournament.name,
			description,
			url,
			startDate: tournament.startsAt,
			image: tournament.bannerUrl ?? tournament.logoUrl ?? undefined,
			eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
			eventStatus:
				tournament.status === 'cancelled'
					? 'https://schema.org/EventCancelled'
					: 'https://schema.org/EventScheduled',
			location: { '@type': 'VirtualLocation', url },
			organizer: organization
		};
	});
</script>

<Seo
	title="{tournament.name} | {t('Tournaments')}"
	ogTitle={tournament.name}
	{description}
	image={tournament.bannerUrl ?? tournament.logoUrl ?? undefined}
	{jsonLd}
/>

<!-- Keyed: another tournament starts with fresh tabs, dialogs and sign-up state. -->
{#key tournament.id}
	<TournamentPage detail={data.detail} />
{/key}
