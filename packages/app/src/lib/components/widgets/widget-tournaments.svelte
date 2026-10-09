<script lang="ts">
	import { resource } from 'runed';
	import { featuredTournaments, TournamentList } from '@company-of-heroes/ui/tournament';
	import { api, unwrapApi } from '$core/api';
	import { Button } from '$lib/components/ui/button';
	import { useI18n } from '$lib/i18n';
	import WidgetPanel from './widget-panel.svelte';

	const { t } = useI18n();

	const tournaments = resource(
		() => true,
		async () => {
			const [active, upcoming] = await Promise.all([
				unwrapApi(api.tournaments.list('active')),
				unwrapApi(api.tournaments.list('upcoming'))
			]);
			// Staff also get drafts in `upcoming`; those never have open registration.
			return featuredTournaments(active, upcoming);
		}
	);
</script>

{#if tournaments.current?.length}
	<WidgetPanel title={t('Tournaments')} summary={t('Running now or open for sign-up.')}>
		{#snippet trailing()}
			<Button href="/tournaments" variant="link" size="sm" class="px-0">{t('View all')}</Button>
		{/snippet}
		<!-- The list closes with its own line; pull it onto the panel's bottom border. -->
		<div class="-mb-px">
			<TournamentList tournaments={tournaments.current} emptyMessage="" />
		</div>
	</WidgetPanel>
{/if}
