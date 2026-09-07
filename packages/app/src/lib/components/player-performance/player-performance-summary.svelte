<script lang="ts">
	import {
		emptyPlayerPerformance,
		getPlayerPerformance,
		type PerformanceRecentMatch,
		type PerformanceScope
	} from '$core/pocketbase/player-performance';
	import * as List from '$lib/components/ui/list';
	import { Badge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import MapImage from '$lib/components/ui/map-image.svelte';
	import { cn, getFactionFlagFromRace, normalizeMapName } from '$lib/utils';
	import { MATCH_TYPES } from '$core/game/lobby';
	import {
		getRaceLabel,
		getRatioColor,
		getRatioValue
	} from '$lib/components/leaderboard/leaderboard-utils';
	import LeaderboardStatPill from '$lib/components/leaderboard/leaderboard-stat-pill.svelte';
	import { interactive, statLosses, statWins } from '$lib/components/ui/variants';
	import { tooltip } from '$lib/attachments';
	import { resource } from 'runed';
	import type { Snippet } from 'svelte';
	import { useI18n } from '$lib/i18n';

	type Props = {
		profileId: number | null | undefined;
		scope: PerformanceScope;
		userId?: string | null;
		empty?: 'self' | 'other';
		class?: string;
		meta?: Snippet;
		steamId?: string | null;
	};

	let {
		profileId,
		scope,
		userId = null,
		empty = 'other',
		class: className,
		meta,
		steamId = null
	}: Props = $props();
	const { t } = useI18n();

	const performance = resource(
		[() => profileId ?? null, () => scope, () => userId ?? null],
		async ([id, nextScope, nextUserId]) => {
			if (!id) return emptyPlayerPerformance();
			if (nextScope === 'user' && !nextUserId) return emptyPlayerPerformance();
			return getPlayerPerformance({
				profileId: id,
				scope: nextScope,
				userId: nextUserId
			});
		},
		{ initialValue: emptyPlayerPerformance() }
	);

	const stats = $derived(performance.current ?? emptyPlayerPerformance());
	const isLoading = $derived(performance.loading && stats.matchCount === 0);
	const emptyMessage = $derived(
		empty === 'self'
			? t('Play with the companion running to build stats.')
			: t('No tracked community matches for this player.')
	);

	const bestMap = $derived.by(() => {
		const eligible = stats.byMap.filter((map) => map.wins + map.losses >= 3);
		const pool = eligible.length > 0 ? eligible : stats.byMap;
		return (
			[...pool].sort(
				(a, b) => getRatioValue(b.wins, b.losses) - getRatioValue(a.wins, b.losses)
			)[0] ?? null
		);
	});
	const recentMatches = $derived(stats.recentMatches ?? []);

	const valueRow = 'inline-flex min-w-0 flex-nowrap items-center gap-2 whitespace-nowrap';
	const recentMatchBase =
		'min-w-6 px-1.5 py-0.5 text-center font-semibold transition-colors duration-150';
	const recentMatchWin =
		'border-success/15 bg-success/5 text-success/45 group-hover:border-success/50 group-hover:bg-success/25 group-hover:text-green-300 group-focus-visible:border-success/50 group-focus-visible:bg-success/25 group-focus-visible:text-green-300';
	const recentMatchLoss =
		'border-destructive/15 bg-destructive/5 text-destructive/45 group-hover:border-destructive/50 group-hover:bg-destructive/25 group-hover:text-red-300 group-focus-visible:border-destructive/50 group-focus-visible:bg-destructive/25 group-focus-visible:text-red-300';

	function winrate(row: { wins: number; losses: number }): string {
		const total = row.wins + row.losses;
		if (total === 0) return '-';
		return `${Math.round((row.wins / total) * 100)}%`;
	}

	function modeLabel(matchtypeId: number): string {
		return MATCH_TYPES[matchtypeId as keyof typeof MATCH_TYPES] ?? t('Mode {id}', { id: matchtypeId });
	}

	function recentMatchLabel(match: PerformanceRecentMatch): string {
		const faction = match.raceId != null ? getRaceLabel(match.raceId) : t('Unknown');
		const mode = match.matchtypeId != null ? modeLabel(match.matchtypeId) : t('Unknown');
		return `${faction} · ${mode}`;
	}

	function recentMatchTooltip(match: PerformanceRecentMatch): string {
		const mode = match.matchtypeId != null ? modeLabel(match.matchtypeId) : t('Unknown');
		if (match.raceId == null) return mode;
		return `<span class="inline-flex items-center gap-1.5 leading-none"><span class="inline-flex p-[3px]"><img src="${getFactionFlagFromRace(match.raceId)}" alt="" class="ring-secondary-800 size-5 shrink-0 rounded-full object-cover ring-4" /></span>${mode}</span>`;
	}
</script>

<div class={cn(meta && 'grid items-start gap-x-10 gap-y-4 sm:grid-cols-2', className)}>
	<List.Root class="grid-cols-[7rem_minmax(0,1fr)] gap-x-4">
		{#if steamId}
			<List.Title>{t('Steam ID:')}</List.Title>
			<List.Value>
				<a
					href="https://steamcommunity.com/profiles/{steamId}"
					target="_blank"
					rel="noopener noreferrer"
					class={cn(interactive, 'hover:text-primary tabular-nums transition-colors')}
				>
					{steamId}
				</a>
			</List.Value>
		{/if}
		{#if isLoading}
			{#each Array(4) as _, index (index)}
				<Skeleton class="h-4 w-20" />
				<Skeleton class="h-4 w-36" />
			{/each}
		{:else if stats.matchCount > 0}
			<List.Title>{t('Tracked:')}</List.Title>
			<List.Value>{t('{count} matches', { count: stats.matchCount })}</List.Value>
			<List.Title>{t('Record:')}</List.Title>
			<List.Value class={valueRow}>
				<span class={statWins}>{t('{count}W', { count: stats.wins })}</span>
				<span class="text-secondary-600">·</span>
				<span class={statLosses}>{t('{count}L', { count: stats.losses })}</span>
				<LeaderboardStatPill type="ratio" wins={stats.wins} losses={stats.losses} streak={0} />
			</List.Value>
			{#if recentMatches.length > 0}
				<List.Title>{t('Recent:')}</List.Title>
				<List.Value class="inline-flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto">
					{#each recentMatches as match (match.id || match.sessionId)}
						<a
							href="/history/{match.id}"
							class={cn(interactive, 'group inline-flex shrink-0')}
							aria-label="{match.outcome === 1 ? t('Win') : t('Loss')} — {recentMatchLabel(match)}"
							{@attach tooltip(recentMatchTooltip(match))}
						>
							<Badge
								variant={match.outcome === 1 ? 'success' : 'destructive'}
								class={cn(
									recentMatchBase,
									match.outcome === 1 ? recentMatchWin : recentMatchLoss
								)}
							>
								{match.outcome === 1 ? t('W') : t('L')}
							</Badge>
						</a>
					{/each}
				</List.Value>
			{/if}
			{#if bestMap}
				<List.Title>{t('Best map:')}</List.Title>
				<List.Value class={valueRow}>
					<MapImage small map={bestMap.map} alt={normalizeMapName(bestMap.map, false)} />
					<span class="text-secondary-300 max-w-44 truncate">
						{normalizeMapName(bestMap.map, false)}
					</span>
					<span class={statWins}>{t('{count}W', { count: bestMap.wins })}</span>
					<span class="text-secondary-600">·</span>
					<span class={statLosses}>{t('{count}L', { count: bestMap.losses })}</span>
					<span class="font-medium" style:color={getRatioColor(bestMap.wins, bestMap.losses)}>
						{winrate(bestMap)}
					</span>
				</List.Value>
			{/if}
		{:else}
			<List.Title>{t('Tracked:')}</List.Title>
			<List.Value class="text-secondary-400 text-sm">{emptyMessage}</List.Value>
		{/if}
	</List.Root>
	{#if meta}
		<div class="min-w-0">
			{@render meta()}
		</div>
	{/if}
</div>
