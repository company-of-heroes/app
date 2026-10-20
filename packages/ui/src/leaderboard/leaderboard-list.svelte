<script lang="ts">
	import RankIcon from '../player/rank-icon.svelte';
	import type { Attachment } from 'svelte/attachments';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { Button } from '@company-of-heroes/ui/button';
	import {
		formatStreak,
		statLosses,
		statStreakClass,
		statWins,
		tableHeadRow,
		tableSortHeader
	} from '@company-of-heroes/ui/variants';
	import CaretUpIcon from 'phosphor-svelte/lib/CaretUpIcon';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CrosshairIcon from 'phosphor-svelte/lib/CrosshairIcon';
	import { useHost } from '../host/host.context';
	import { tooltip } from '../attachments';
	import type { LeaderboardStatRow } from '../format/types';
	import { useLeaderboard } from './context';
	import { games, type LeaderboardSortKey } from './highlights';
	import { leaderboardRowId } from './leaderboard-state.svelte';
	import LeaderboardChange from './leaderboard-change.svelte';
	import LeaderboardElo from './leaderboard-elo.svelte';
	import LeaderboardPlayer from './leaderboard-player.svelte';
	import LeaderboardRecord from './leaderboard-record.svelte';

	const { t } = useI18n();
	const host = useHost();
	const leaderboard = useLeaderboard();

	/** Pos · change · level · ELO · player · games · wins · losses · win rate · streak; narrow screens keep three. */
	const grid =
		'grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 md:grid-cols-[2.75rem_3.5rem_3.5rem_3.5rem_minmax(0,1fr)_4rem_3.5rem_3.5rem_4.5rem_4rem]';

	let ownVisible = $state(false);

	const ownRank = $derived(leaderboard.ownRow?.rank ?? leaderboard.ownStat?.rank ?? null);
	/** On the podium the viewer is already in plain sight. */
	const ownOnPodium = $derived(
		leaderboard.showPodium && leaderboard.ownRow !== null && leaderboard.ownRow.rank <= 3
	);
	const showOwnBar = $derived(ownRank !== null && !ownVisible && !ownOnPodium);

	/** Tracks whether the viewer's row is on screen; the sticky bar shows while it is not. */
	const trackOwn: Attachment<HTMLElement> = (node) => {
		const observer = new IntersectionObserver((entries) => {
			ownVisible = entries[0]?.isIntersecting ?? false;
		});
		observer.observe(node);
		return () => {
			observer.disconnect();
			ownVisible = false;
		};
	};

	function sortState(key: LeaderboardSortKey): 'ascending' | 'descending' | 'none' {
		if (leaderboard.sort.key !== key) {
			return 'none';
		}

		// Best first reads as ascending for rank, descending for every other value.
		const bestFirst = !leaderboard.sort.reverse;
		return (key === 'rank') === bestFirst ? 'ascending' : 'descending';
	}
</script>

{#snippet sortHeader(
	key: LeaderboardSortKey,
	label: string,
	align: 'left' | 'center' | 'right',
	hint?: string
)}
	{@const state = sortState(key)}
	<div role="columnheader" aria-sort={state}>
		<button
			type="button"
			aria-label={hint}
			{@attach hint ? tooltip(hint) : undefined}
			class={cn(
				tableSortHeader,
				'gap-1 hover:text-white',
				align === 'center' && 'justify-center',
				align === 'right' && 'justify-end',
				state !== 'none' && 'text-primary'
			)}
			onclick={() => leaderboard.toggleSort(key)}
		>
			{label}
			{#if state === 'ascending'}
				<CaretUpIcon class="size-3" weight="fill" />
			{:else if state === 'descending'}
				<CaretDownIcon class="size-3" weight="fill" />
			{/if}
		</button>
	</div>
{/snippet}

{#snippet row(stat: LeaderboardStatRow)}
	{@const own = leaderboard.isOwn(stat)}
	<div
		id={leaderboardRowId(stat.profile.profile_id)}
		role="row"
		class={cn(
			grid,
			'border-secondary-800/70 hover:bg-secondary-950/50 min-h-12 scroll-mt-40 border-b py-2 text-white transition-colors duration-700',
			own && 'bg-primary/[0.06] shadow-[inset_3px_0_0_var(--color-primary)]',
			leaderboard.flashed === stat.profile.profile_id && 'bg-primary/20 duration-150'
		)}
		{@attach own ? trackOwn : undefined}
	>
		<div role="cell" class="flex flex-col items-start leading-tight">
			<span
				class={cn(
					'text-sm font-semibold tabular-nums',
					own ? 'text-primary' : 'text-secondary-300'
				)}
			>
				#{stat.rank}
			</span>
			<LeaderboardChange change={stat.change?.day} class="text-xs md:hidden" />
		</div>
		<div role="cell" class="hidden text-sm md:block">
			<LeaderboardChange change={stat.change?.day} />
		</div>
		<div role="cell" class="hidden items-center justify-center gap-1.5 md:flex">
			<RankIcon
				level={stat.ranklevel}
				leaderboardId={stat.leaderboard_id}
				position={stat.rank}
				class="size-6"
			/>
			<span class="text-secondary-400 text-sm tabular-nums">{stat.ranklevel}</span>
		</div>
		<div role="cell" class="hidden justify-center md:flex">
			<LeaderboardElo elo={leaderboard.elo(stat)} />
		</div>
		<div role="cell" class="flex min-w-0 items-center gap-2">
			<RankIcon
				level={stat.ranklevel}
				leaderboardId={stat.leaderboard_id}
				position={stat.rank}
				class="size-6 md:hidden"
			/>
			<LeaderboardPlayer {stat} class="min-w-0" />
			<LeaderboardElo elo={leaderboard.elo(stat)} class="md:hidden" />
		</div>
		<div role="cell" class="text-secondary-300 hidden text-center text-sm tabular-nums md:block">
			{games(stat)}
		</div>
		<div role="cell" class={cn(statWins, 'hidden text-center text-sm md:block')}>
			{stat.wins}
		</div>
		<div role="cell" class={cn(statLosses, 'hidden text-center text-sm md:block')}>
			{stat.losses}
		</div>
		<div role="cell">
			<LeaderboardRecord
				wins={stat.wins}
				losses={stat.losses}
				compact
				bar={false}
				class="justify-end"
			/>
		</div>
		<div
			role="cell"
			class={cn('hidden text-center text-sm font-medium md:block', statStreakClass(stat.streak))}
		>
			{formatStreak(stat.streak)}
		</div>
	</div>
{/snippet}

<div role="table" aria-label={t('Leaderboard')} aria-rowcount={leaderboard.rows.length}>
	<div
		role="row"
		class={cn(grid, tableHeadRow, 'sticky top-(--leaderboard-top) z-10 h-9 backdrop-blur')}
	>
		{@render sortHeader('rank', t('Pos'), 'left')}
		<div class="hidden md:block">
			{@render sortHeader('change', t('Change'), 'left', t('Rank change since yesterday'))}
		</div>
		<div role="columnheader" class="hidden text-center md:block">{t('Rank')}</div>
		<div class="hidden md:block">{@render sortHeader('elo', t('ELO'), 'center')}</div>
		<div role="columnheader">{t('Player')}</div>
		<div class="hidden md:block">{@render sortHeader('games', t('Games'), 'center')}</div>
		<div role="columnheader" class="hidden text-center md:block">{t('Wins')}</div>
		<div role="columnheader" class="hidden text-center md:block">{t('Losses')}</div>
		{@render sortHeader('winrate', t('Win rate'), 'right')}
		<div class="hidden md:block">{@render sortHeader('streak', t('Streak'), 'center')}</div>
	</div>

	{#if leaderboard.tableRows.length === 0 && !leaderboard.showPodium}
		<div class="flex flex-col items-center gap-3 px-4 py-12 text-center">
			<p class="text-secondary-400">{t('No players found.')}</p>
			{#if leaderboard.filtered}
				<Button variant="secondary" size="sm" onclick={() => leaderboard.resetFilters()}>
					{t('Clear filters')}
				</Button>
			{/if}
		</div>
	{:else}
		<div role="rowgroup" class="-mb-px">
			{#each leaderboard.tableRows as stat (stat.profile.profile_id)}
				{@render row(stat)}
			{/each}
		</div>
	{/if}

	{#if showOwnBar}
		{@const ownRow = leaderboard.ownRow}
		{@const ownStat = leaderboard.ownStat}
		<div
			class="border-primary/30 sticky bottom-0 z-10 flex items-center gap-3 border-t bg-gray-950/95 px-4 py-2.5 backdrop-blur"
		>
			<span class="text-primary font-heading text-lg font-bold tabular-nums">#{ownRank}</span>
			{#if ownRow}
				<LeaderboardChange change={ownRow.change?.day} class="text-sm" />
				<LeaderboardPlayer stat={ownRow} compact class="min-w-0 flex-1" />
				<Button
					variant="secondary"
					size="sm"
					onclick={() => leaderboard.jumpTo(ownRow.profile.profile_id)}
				>
					<CrosshairIcon class="size-4" />
					<span class="max-sm:sr-only">{t('Jump to me')}</span>
				</Button>
			{:else if ownStat}
				<span class="text-secondary-300 min-w-0 flex-1 truncate text-sm">
					{t('Outside the top 200')}
				</span>
				<LeaderboardRecord
					wins={ownStat.wins}
					losses={ownStat.losses}
					bar={false}
					class="max-sm:hidden"
				/>
			{/if}
		</div>
	{/if}
</div>
