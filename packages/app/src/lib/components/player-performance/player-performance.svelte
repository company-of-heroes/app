<script lang="ts">
	import {
		emptyPlayerPerformance,
		getPlayerPerformance,
		type PerformanceScope,
		type PlayerPerformance as PerformanceData
	} from '$core/pocketbase/player-performance';
	import { PlayerPerformancePanel } from '@company-of-heroes/ui/player-performance';
	import { cn, normalizeMapName } from '$lib/utils';
	import { MATCH_TYPES } from '$core/game/lobby';
	import { getRaceLabel } from '$lib/components/leaderboard/leaderboard-utils';
	import { resource } from 'runed';
	import PlayerPerformanceMatches from './player-performance-matches.svelte';
	import { EloHistory } from '@company-of-heroes/ui/player-performance';
	import {
		getPlayerEloHistory,
		groupEloHistoryByModeAndRace
	} from '$core/pocketbase/player-ratings';
	import type { PlayerEloHistoryPoint } from '$core/pocketbase/player-ratings';
	import { useI18n } from '$lib/i18n';
	import { dev } from '$app/environment';

	type Props = {
		profileId: number | null | undefined;
		scope: PerformanceScope;
		userId?: string | null;
		empty?: 'self' | 'other';
		class?: string;
		refreshKey?: number;
		performance?: PerformanceData | null;
	};

	let {
		profileId,
		scope,
		userId = null,
		empty = 'other',
		class: className,
		refreshKey = 0,
		performance: performanceProp = null
	}: Props = $props();
	const { t } = useI18n();

	const performance = resource(
		[
			() => profileId ?? null,
			() => scope,
			() => userId ?? null,
			() => refreshKey,
			() => performanceProp
		],
		async ([id, nextScope, nextUserId, generation, provided]) => {
			if (provided && generation === 0) {
				return provided;
			}

			if (!id) {
				return emptyPlayerPerformance();
			}

			if (nextScope === 'user' && !nextUserId) {
				return emptyPlayerPerformance();
			}

			return getPlayerPerformance({
				profileId: id,
				scope: nextScope,
				userId: nextUserId,
				fresh: generation > 0
			});
		},
		{ initialValue: emptyPlayerPerformance() }
	);

	const stats = $derived(performance.current ?? emptyPlayerPerformance());
	const emptyMessage = $derived(
		empty === 'self'
			? t('Play with the companion running to build stats.')
			: t('No tracked community matches for this player.')
	);

	let eloExpanded = $state(false);

	const eloHistory = resource(
		[() => (eloExpanded ? (profileId ?? null) : null)],
		async ([id]) => {
			if (!id) {
				return [] as PlayerEloHistoryPoint[];
			}

			return getPlayerEloHistory({ profileId: id });
		},
		{ initialValue: [] as PlayerEloHistoryPoint[] }
	);

	const eloPoints = $derived(eloHistory.current ?? []);
	const eloModeCount = $derived(Object.keys(groupEloHistoryByModeAndRace(eloPoints)).length);
	const eloSummary = $derived(
		!eloExpanded
			? t('Tracked lobby ratings')
			: eloHistory.loading && eloPoints.length === 0
				? t('Loading…')
				: t('{points} rating points · {modes} modes', {
						points: eloPoints.length,
						modes: eloModeCount
					})
	);

	function modeLabel(matchtypeId: number): string {
		return (
			MATCH_TYPES[matchtypeId as keyof typeof MATCH_TYPES] ?? t('Mode {id}', { id: matchtypeId })
		);
	}
</script>

<div class={cn(className)}>
	<PlayerPerformancePanel
		performance={stats}
		includeSkirmish={dev}
		emptyPerformanceMessage={emptyMessage}
		trackedLobbyRatingsLabel={eloSummary}
	>
		{#snippet eloContent()}
			{#if profileId}
				<EloHistory points={eloPoints} loading={eloHistory.loading} />
			{/if}
		{/snippet}
		{#snippet mapRowDetail(row)}
			{#if profileId}
				<PlayerPerformanceMatches
					maps={[row.map]}
					{profileId}
					{scope}
					{userId}
					totalGames={row.wins + row.losses}
					showMap={false}
					label={t('on {map}', { map: normalizeMapName(row.map) })}
					emptyMessage={t('No matches found for this map.')}
				/>
			{/if}
		{/snippet}
		{#snippet factionRowDetail(row)}
			{#if profileId}
				<PlayerPerformanceMatches
					races={[row.raceId]}
					{profileId}
					{scope}
					{userId}
					totalGames={row.wins + row.losses}
					label={t('as {faction}', { faction: getRaceLabel(row.raceId) })}
					emptyMessage={t('No matches found for this faction.')}
				/>
			{/if}
		{/snippet}
		{#snippet modeRowDetail(row)}
			{#if profileId}
				<PlayerPerformanceMatches
					matchtypes={[row.matchtypeId]}
					{profileId}
					{scope}
					{userId}
					totalGames={row.wins + row.losses}
					label={t('in {mode}', { mode: modeLabel(row.matchtypeId) })}
					emptyMessage={t('No matches found for this mode.')}
				/>
			{/if}
		{/snippet}
	</PlayerPerformancePanel>
</div>
