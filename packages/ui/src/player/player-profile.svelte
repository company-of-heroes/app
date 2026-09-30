<script lang="ts">
	import type { Snippet } from 'svelte';
	import { useI18n } from '@company-of-heroes/i18n';
	import { formatRelative } from '../format/date';
	import { useHost } from '../host/host.context';
	import * as Tabs from '../ui/tabs';
	import type { PlayerPageData, TransformedMatch } from './types';
	import PlayerMatchHistory from './player-match-history.svelte';
	import PlayerMatchHistorySkeleton from './player-match-history-skeleton.svelte';
	import PlayerProfileHeader from './player-profile-header.svelte';
	import PlayerStatsTable from './player-stats-table.svelte';
	import PlayerPerformancePanel from '../player-performance/player-performance-panel.svelte';

	type Props = {
		player: PlayerPageData;
		tab?: string;
		/** Host-only extras in the header action row (e.g. label editor, cheater alert). */
		actions?: Snippet;
		/** Performance tab body; defaults to the panel over `player.performance`. */
		performance?: Snippet;
		/** Host-only extra tabs: render `Tabs.Trigger`s here… */
		extraTabs?: Snippet;
		/** …and the matching `Tabs.Content`s here. */
		extraTabContent?: Snippet;
		matchHistoryLoading?: boolean;
		matchActions?: Snippet<[{ match: TransformedMatch }]>;
	};

	let {
		player,
		tab = $bindable('stats'),
		actions,
		performance,
		extraTabs,
		extraTabContent,
		matchHistoryLoading = false,
		matchActions
	}: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const showAvatars = $derived(
		player.matchHistory.some((match) => match.players.some((p) => Boolean(p.avatarUrl)))
	);
</script>

<div class="border-secondary-900 overflow-clip border-b">
	<PlayerProfileHeader {player} {actions} />
	<Tabs.Root bind:value={tab} class="border-secondary-800 border-b">
		<Tabs.List class="min-w-0 flex-wrap px-4 py-2.5">
			<Tabs.Trigger value="stats">{t('Stats')}</Tabs.Trigger>
			<Tabs.Trigger value="performance">{t('Performance')}</Tabs.Trigger>
			<Tabs.Trigger value="match-history">{t('Match history')}</Tabs.Trigger>
			{@render extraTabs?.()}
		</Tabs.List>
		<div class="border-secondary-800 border-t">
			<Tabs.Content value="stats">
				<PlayerStatsTable stats={player.leaderboardStats} elo={player.elo} />
			</Tabs.Content>
			<Tabs.Content value="performance">
				{#if performance}
					{@render performance()}
				{:else if player.performance}
					<PlayerPerformancePanel performance={player.performance} elo={player.elo} />
				{/if}
			</Tabs.Content>
			<Tabs.Content value="match-history">
				{#if matchHistoryLoading}
					<PlayerMatchHistorySkeleton />
				{:else}
					<PlayerMatchHistory {player} {showAvatars} {matchActions} />
				{/if}
			</Tabs.Content>
			{@render extraTabContent?.()}
		</div>
	</Tabs.Root>
	<div
		class="text-secondary-400 bg-secondary-950/50 flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-sm"
	>
		{#if player.lastlogoff}
			<span>
				<span class="text-secondary-500">{t('Last seen')}</span>
				{formatRelative(player.lastlogoff, host.locale())}
			</span>
		{/if}
		{#if player.playtimeForever}
			<span>
				<span class="text-secondary-500">{t('Playtime')}</span>
				{t('{hours} hours', { hours: Math.round(player.playtimeForever / 60) })}
			</span>
		{/if}
		{#if player.playtime2weeks}
			<span>
				<span class="text-secondary-500">{t('Past 2 weeks')}</span>
				{t('{hours} hours', { hours: Math.round(player.playtime2weeks / 60) })}
			</span>
		{/if}
	</div>
</div>
