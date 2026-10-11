<script lang="ts">
	import { app } from '$core/app/context';
	import { Button } from '../ui/button';
	import TodayMatchesTable from './today-matches-table.svelte';
	import WidgetPanel from './widget-panel.svelte';
	import {
		collectTodayMatchSteamIds,
		isMatchFromLast24Hours,
		matchIncludesSteamIds
	} from './dashboard-utils';
	import { useTodayLobbies } from './today-lobbies.svelte';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	const todayLobbies = useTodayLobbies();
	const steamIds = $derived(collectTodayMatchSteamIds(app.features.auth.user.steamIds));
	const matches = $derived(
		todayLobbies.items.filter(
			(match) => isMatchFromLast24Hours(match) && matchIncludesSteamIds(match, steamIds)
		)
	);
</script>

<WidgetPanel
	title={t('Recent matches')}
	summary={!todayLobbies.loading ? t('{count} played', { count: matches.length }) : undefined}
>
	{#snippet trailing()}
		<Button href="/history" variant="link" size="sm" class="px-0">{t('View all')}</Button>
	{/snippet}
	{#if todayLobbies.loading}
		<TodayMatchesTable matches={[]} loading />
	{:else if matches.length === 0}
		<p class="text-secondary-400 px-4 py-3 text-sm">
			{t('You have not played any matches in the last 24 hours.')}
		</p>
	{:else}
		<TodayMatchesTable {matches} />
	{/if}
</WidgetPanel>
