<script lang="ts">
	import type { Compare } from '@company-of-heroes/api/compare';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { factionIcon, tableHeadRow } from '@company-of-heroes/ui/variants';
	import { escapeHtml, tooltip } from '../attachments/tooltip.svelte';
	import {
		getMatchTypeIdFromLeaderboardId,
		getModeLabel,
		getRaceFromLeaderboardId,
		getRaceLabel,
		getStoredEloForLeaderboard
	} from '../format/player-format';
	import { getLeaderboardTypeLabel } from '../format/ranks';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import CompareShare from './compare-share.svelte';
	import { useCompare } from './context';
	import { accountName, betterSide, mirroredRow, winShare, type CompareSide } from './format';

	type Props = {
		class?: string;
	};

	type Performance = Compare['me']['performance'];

	type Ladder = {
		rank: number | null;
		elo: number | null;
		/** Account names holding the value (my side only). */
		rankHolder?: string;
		eloHolder?: string;
	};

	let { class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
	const context = useCompare();

	const compare = $derived(context.compare);

	function holder(steamId: string) {
		return accountName(
			compare.accounts.find((account) => account.steamId === steamId),
			steamId
		);
	}

	function myLadder(leaderboardId: number): Ladder {
		const best = compare.me.best.find(
			(item) => item.leaderboardId === leaderboardId && item.rank > 0
		);
		const matchType = getMatchTypeIdFromLeaderboardId(leaderboardId);
		const race = String(getRaceFromLeaderboardId(leaderboardId));
		const elo =
			matchType == null
				? undefined
				: compare.me.elo.find(
						(item) =>
							item.matchKey === String(matchType) && item.raceKey === race && item.rating >= 1
					);
		return {
			rank: best?.rank ?? null,
			elo: elo?.rating ?? null,
			rankHolder: best ? holder(best.steamId) : undefined,
			eloHolder: elo ? holder(elo.steamId) : undefined
		};
	}

	function theirLadder(leaderboardId: number): Ladder {
		const stat = compare.them.leaderboardStats.find(
			(item) => item.leaderboard_id === leaderboardId && item.rank > 0
		);
		return {
			rank: stat?.rank ?? null,
			elo: getStoredEloForLeaderboard(compare.them.elo, leaderboardId)
		};
	}

	const ladders = $derived.by(() => {
		const ids = new Set([
			...compare.me.best.filter((item) => item.rank > 0).map((item) => item.leaderboardId),
			...compare.them.leaderboardStats
				.filter((item) => item.rank > 0)
				.map((item) => item.leaderboard_id)
		]);
		return [...ids]
			.sort((a, b) => a - b)
			.map((leaderboardId) => ({
				leaderboardId,
				mine: myLadder(leaderboardId),
				theirs: theirLadder(leaderboardId)
			}));
	});

	const myShare = $derived(winShare(compare.me.performance));
	const theirShare = $derived(winShare(compare.them.performance));
	const shareBetter = $derived(betterSide(myShare, theirShare));

	function recentTitle(match: Performance['recentMatches'][number]) {
		return [
			match.outcome === 1 ? t('Win') : t('Loss'),
			match.raceId != null ? getRaceLabel(match.raceId) : null,
			match.matchtypeId != null ? getModeLabel(match.matchtypeId) : null
		]
			.filter(Boolean)
			.join(' · ');
	}
</script>

{#snippet ladderCell(ladder: Ladder, side: CompareSide, other: Ladder)}
	{@const rankBetter = betterSide(ladder.rank, other.rank, false) === side}
	{@const eloBetter = betterSide(ladder.elo, other.elo) === side}
	<div class="flex min-w-0 flex-wrap items-baseline justify-center gap-x-1.5 tabular-nums">
		{#if ladder.rank == null && ladder.elo == null}
			<span class="text-secondary-500">—</span>
		{:else}
			{#if ladder.rank != null}
				<span
					class={cn('font-medium', rankBetter ? 'text-primary' : 'text-white')}
					{@attach tooltip(ladder.rankHolder ? escapeHtml(ladder.rankHolder) : null)}
				>
					#{ladder.rank}
				</span>
			{/if}
			{#if ladder.rank != null && ladder.elo != null}
				<span class="text-secondary-600">·</span>
			{/if}
			{#if ladder.elo != null}
				<span
					class={eloBetter ? 'text-primary' : 'text-secondary-200'}
					{@attach tooltip(ladder.eloHolder ? escapeHtml(ladder.eloHolder) : null)}
				>
					{ladder.elo}
					<span class="text-secondary-500 text-xs">{t('ELO')}</span>
				</span>
			{/if}
		{/if}
	</div>
{/snippet}

{#snippet formCell(performance: Performance)}
	{@const recent = performance.recentMatches.slice(0, 10)}
	<div class="flex min-w-0 flex-wrap justify-center gap-1">
		{#each recent as match (match.id || match.sessionId)}
			<Badge variant={match.outcome === 1 ? 'success' : 'destructive'} title={recentTitle(match)}>
				{match.outcome === 1 ? t('W') : t('L')}
			</Badge>
		{:else}
			<span class="text-secondary-500">—</span>
		{/each}
	</div>
{/snippet}

<section class={cn('border-secondary-800 border-b text-sm', className)}>
	<div class={cn(tableHeadRow, mirroredRow, 'py-2')}>
		<span class="truncate text-center">{t('You')}</span>
		<span class="truncate text-center">{t('Mode')}</span>
		<span class="truncate text-center">{compare.them.alias}</span>
	</div>
	<!-- Rows close themselves; -mb-px lands the last line on the section's closing border. -->
	<div class="-mb-px">
		{#each ladders as ladder (ladder.leaderboardId)}
			<div class={cn(mirroredRow, 'border-secondary-800 border-b py-2')}>
				{@render ladderCell(ladder.mine, 'me', ladder.theirs)}
				<div class="flex min-w-0 items-center justify-center gap-2">
					<img
						src={host.resolve.factionFlagByLeaderboard(ladder.leaderboardId)}
						alt=""
						class={factionIcon}
					/>
					<span class="min-w-0 truncate text-white">
						{getLeaderboardTypeLabel(ladder.leaderboardId)}
					</span>
				</div>
				{@render ladderCell(ladder.theirs, 'them', ladder.mine)}
			</div>
		{/each}
		<div class={cn(mirroredRow, 'border-secondary-800 border-b py-2')}>
			<CompareShare record={compare.me.performance} better={shareBetter === 'me'} />
			<span class="text-secondary-300 truncate text-center">{t('Win rate (games)')}</span>
			<CompareShare record={compare.them.performance} better={shareBetter === 'them'} />
		</div>
		<div class={cn(mirroredRow, 'border-secondary-800 border-b py-2')}>
			{@render formCell(compare.me.performance)}
			<span class="text-secondary-300 truncate text-center">{t('Recent form')}</span>
			{@render formCell(compare.them.performance)}
		</div>
	</div>
</section>
