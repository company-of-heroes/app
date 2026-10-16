<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { ToggleGroup } from '@company-of-heroes/ui/toggle-group';
	import { useLeaderboard } from './context';
	import { climbers, fallers, newcomers } from './highlights';
	import LeaderboardChange from './leaderboard-change.svelte';
	import LeaderboardPanel from './leaderboard-panel.svelte';
	import LeaderboardSideRow from './leaderboard-side-row.svelte';

	type Tab = 'up' | 'down' | 'new';

	const { t } = useI18n();
	const leaderboard = useLeaderboard();

	let tab = $state<Tab>('up');

	const tabs = $derived([
		{ value: 'up', label: t('Climbers') },
		{ value: 'down', label: t('Fallers') },
		{ value: 'new', label: t('New') }
	]);
	const period = $derived(leaderboard.period);
	const players = $derived.by(() => {
		if (!period) {
			return [];
		}

		if (tab === 'down') {
			return fallers(leaderboard.stats, period);
		}

		return tab === 'new' ? newcomers(leaderboard.stats, period) : climbers(leaderboard.stats, period);
	});
</script>

<LeaderboardPanel
	title={t('Movement')}
	meta={period === 'week' ? t('Since last week') : period === 'day' ? t('Since yesterday') : undefined}
>
	{#snippet actions()}
		<ToggleGroup
			size="sm"
			items={tabs}
			bind:value={() => tab, (value) => (tab = value as Tab)}
			aria-label={t('Movement')}
		/>
	{/snippet}
	{#if !period}
		<p class="text-secondary-400 px-4 pb-4 text-sm">
			{t('Rank movement shows up after the first daily snapshot of this ladder.')}
		</p>
	{:else if players.length === 0}
		<p class="text-secondary-400 px-4 pb-4 text-sm">{t('Nobody here yet.')}</p>
	{:else}
		<ol class="pb-2">
			{#each players as stat (stat.profile.profile_id)}
				<LeaderboardSideRow {stat}>
					{#snippet trailing()}
						<LeaderboardChange change={stat.change?.[period]} {period} />
					{/snippet}
				</LeaderboardSideRow>
			{/each}
		</ol>
	{/if}
</LeaderboardPanel>
