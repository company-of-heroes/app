<script lang="ts">
	import type { CompareView } from './types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { factionIcon, tableHeadRow } from '@company-of-heroes/ui/variants';
	import { escapeHtml, tooltip } from '../attachments/tooltip.svelte';
	import {
		getEloColor,
		getEloTextShadow,
		getMatchTypeIdFromLeaderboardId,
		getRaceFromLeaderboardId,
		getStoredEloForLeaderboard,
		isEliteElo
	} from '../format/player-format';
	import { getLeaderboardTypeLabel } from '../format/ranks';
	import { useHost } from '../host/host.context';
	import MatchResultBadge from '../player/match-result-badge.svelte';
	import CompareShare from './compare-share.svelte';
	import { useCompare } from './context';
	import { accountName, mirroredRow } from './format';

	type Props = {
		class?: string;
	};

	type Performance = CompareView['me']['performance'];

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
</script>

{#snippet ladderCell(ladder: Ladder)}
	<div class="flex min-w-0 flex-wrap items-baseline justify-center gap-x-1.5 tabular-nums">
		{#if ladder.rank == null && ladder.elo == null}
			<span class="text-secondary-500">—</span>
		{:else}
			{#if ladder.rank != null}
				<span
					class="font-semibold text-white"
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
					class={isEliteElo(ladder.elo) ? 'font-bold tracking-wide' : 'font-medium'}
					style:color={getEloColor(ladder.elo)}
					style:text-shadow={getEloTextShadow(ladder.elo)}
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
			<MatchResultBadge {match} />
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
				{@render ladderCell(ladder.mine)}
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
				{@render ladderCell(ladder.theirs)}
			</div>
		{/each}
		<div class={cn(mirroredRow, 'border-secondary-800 border-b py-2')}>
			<CompareShare record={compare.me.performance} />
			<span class="text-secondary-300 truncate text-center">{t('Win rate (games)')}</span>
			<CompareShare record={compare.them.performance} />
		</div>
		<div class={cn(mirroredRow, 'border-secondary-800 border-b py-2')}>
			{@render formCell(compare.me.performance)}
			<span class="text-secondary-300 truncate text-center">{t('Recent form')}</span>
			{@render formCell(compare.them.performance)}
		</div>
	</div>
</section>
