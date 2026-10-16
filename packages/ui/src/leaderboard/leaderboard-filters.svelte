<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { Button } from '@company-of-heroes/ui/button';
	import { Select } from '@company-of-heroes/ui/input';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { countryDisplayName } from '../format/country';
	import { useHost } from '../host/host.context';
	import { useLeaderboard } from './context';
	import { countryCounts, type LeaderboardSortKey } from './highlights';

	const ALL = 'all';
	const MIN_GAMES = [0, 50, 100, 250, 500];

	const { t } = useI18n();
	const host = useHost();
	const leaderboard = useLeaderboard();

	const countryItems = $derived([
		{ value: ALL, label: t('All countries') },
		...countryCounts(leaderboard.stats).map(({ country, count }) => ({
			value: country,
			label: `${countryDisplayName(country, host.locale()) ?? country.toUpperCase()} (${count})`
		}))
	]);
	const minGameItems = $derived(
		MIN_GAMES.map((count) => ({
			value: String(count),
			label: count === 0 ? t('Any number of games') : t('{count}+ games', { count })
		}))
	);
	const sortItems = $derived<{ value: LeaderboardSortKey; label: string }[]>([
		{ value: 'rank', label: t('Rank') },
		{ value: 'change', label: t('Biggest climb') },
		{ value: 'elo', label: t('ELO') },
		{ value: 'games', label: t('Most games') },
		{ value: 'winrate', label: t('Win rate') },
		{ value: 'streak', label: t('Streak') }
	]);
</script>

<div
	class="border-secondary-800 flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5 text-sm"
>
	<Select
		type="single"
		size="sm"
		class="w-auto min-w-40"
		items={countryItems}
		aria-label={t('Country')}
		bind:value={
			() => leaderboard.filters.country ?? ALL,
			(value) => (leaderboard.filters.country = value === ALL ? null : value)
		}
	/>
	<Select
		type="single"
		size="sm"
		class="w-auto min-w-40"
		items={minGameItems}
		aria-label={t('Minimum games')}
		bind:value={
			() => String(leaderboard.filters.minGames),
			(value) => (leaderboard.filters.minGames = Number(value) || 0)
		}
	/>
	<Select
		type="single"
		size="sm"
		class="w-auto min-w-36"
		items={sortItems}
		aria-label={t('Sort by')}
		bind:value={
			(): string => leaderboard.sort.key,
			(value) => (leaderboard.sort = { key: value as LeaderboardSortKey, reverse: false })
		}
	/>
	<span class="text-secondary-400 ml-auto tabular-nums">
		{t('{count} players', { count: leaderboard.rows.length })}
	</span>
	{#if leaderboard.filtered}
		<Button variant="ghost" size="sm" onclick={() => leaderboard.resetFilters()}>
			<XIcon class="size-4" />
			{t('Clear filters')}
		</Button>
	{/if}
</div>
