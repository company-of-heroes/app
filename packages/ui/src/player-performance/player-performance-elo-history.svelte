<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive, tabTrigger } from '@company-of-heroes/ui/variants';
	import { getModeLabel, getRaceLabel } from '../format/player-format';
	import { Axis, Circle, Highlight, Layer, LineChart, Spline, Text, Tooltip } from 'layerchart';
	import { IsInViewport } from 'runed';

	export type EloHistoryPoint = {
		at: number;
		rating: number;
		matchtypeId: number;
		raceId: number;
	};

	type Props = {
		points: EloHistoryPoint[];
		loading?: boolean;
		getModeLabel?: (matchtypeId: number) => string;
		getRaceLabel?: (raceId: number) => string;
		resolveFactionFlag?: (raceId: number) => string;
		formatAxisDate?: (date: Date) => string;
		formatTooltipDate?: (date: Date) => string;
		formatTooltipRating?: (rating: number) => string;
		loadingMessage?: string;
		emptyMessage?: string;
		emptyModeMessage?: string;
		factionNavLabel?: string;
	};

	let {
		points,
		loading = false,
		getModeLabel: modeLabel = getModeLabel,
		getRaceLabel: raceLabel = getRaceLabel,
		resolveFactionFlag = () => '',
		formatAxisDate = (date) =>
			date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }),
		formatTooltipDate = (date) =>
			date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }),
		formatTooltipRating = (rating) => `${rating} ELO`,
		loadingMessage = 'Loading ELO history…',
		emptyMessage = 'No tracked match ratings yet. Play with the companion running so lobby results can build this history.',
		emptyModeMessage = 'No faction ratings for this mode yet.',
		factionNavLabel = 'Select faction'
	}: Props = $props();

	type GroupedPoints = Record<number, Record<number, EloHistoryPoint[]>>;

	const grouped = $derived(groupPoints(points));
	const modeIds = $derived(
		Object.keys(grouped)
			.map(Number)
			.sort((a, b) => a - b)
	);

	let selectedMode = $state<number | null>(null);
	let selectedRace = $state<number | null>(null);

	const activeMode = $derived(
		selectedMode != null && modeIds.includes(selectedMode) ? selectedMode : (modeIds[0] ?? null)
	);

	const raceIds = $derived.by(() => {
		if (activeMode == null) return [] as number[];
		return Object.keys(grouped[activeMode] ?? {})
			.map(Number)
			.filter((raceId) => (grouped[activeMode]?.[raceId]?.length ?? 0) > 0)
			.sort((a, b) => a - b);
	});

	const activeRace = $derived(
		selectedRace != null && raceIds.includes(selectedRace) ? selectedRace : (raceIds[0] ?? null)
	);

	type ChartPoint = {
		at: Date;
		rating: number;
		label: string;
	};

	const chartData = $derived.by(() => {
		if (activeMode == null || activeRace == null) return [] as ChartPoint[];
		const racePoints = grouped[activeMode]?.[activeRace] ?? [];
		const label = raceLabel(activeRace);
		const byDay: Record<string, ChartPoint> = {};

		for (const point of racePoints) {
			const at = new Date(point.at * 1000);
			const dayKey = at.toISOString().slice(0, 10);
			byDay[dayKey] = {
				at: new Date(at.getFullYear(), at.getMonth(), at.getDate()),
				rating: point.rating,
				label
			};
		}

		return Object.values(byDay).sort((a, b) => a.at.getTime() - b.at.getTime());
	});

	const activeRaceLabel = $derived(activeRace != null ? raceLabel(activeRace) : 'Faction');

	let target = $state<HTMLElement>();
	const isInViewport = new IsInViewport(() => target);

	function groupPoints(history: EloHistoryPoint[]): GroupedPoints {
		const result: GroupedPoints = {};
		for (const point of history) {
			if (!result[point.matchtypeId]) result[point.matchtypeId] = {};
			if (!result[point.matchtypeId][point.raceId]) result[point.matchtypeId][point.raceId] = [];
			result[point.matchtypeId][point.raceId].push(point);
		}
		return result;
	}

	function selectMode(matchtypeId: number) {
		selectedMode = matchtypeId;
		selectedRace = null;
	}
</script>

{#if loading && points.length === 0}
	<p class="text-secondary-400 px-4 py-6 text-sm">{loadingMessage}</p>
{:else if points.length === 0}
	<p class="text-secondary-400 px-4 py-6 text-sm">{emptyMessage}</p>
{:else}
	<div class="flex flex-col">
		<div class="border-secondary-800 flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
			{#each modeIds as matchtypeId (matchtypeId)}
				<button
					type="button"
					class={cn(tabTrigger, 'text-xs tracking-wide uppercase')}
					data-state={activeMode === matchtypeId ? 'active' : undefined}
					onclick={() => selectMode(matchtypeId)}
				>
					{modeLabel(matchtypeId)}
				</button>
			{/each}
		</div>

		{#if raceIds.length > 0 && activeRace != null}
			<div
				class="grid min-h-0 grid-cols-1 items-stretch md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]"
			>
				<nav
					class="border-secondary-800 divide-secondary-800 flex h-full min-h-0 flex-col divide-y border-b md:border-r md:border-b-0"
					aria-label={factionNavLabel}
				>
					{#each raceIds as raceId (raceId)}
						{@const isSelected = activeRace === raceId}
						<button
							type="button"
							class={cn(
								interactive,
								'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors',
								isSelected
									? 'bg-secondary-950/80 text-primary font-medium'
									: 'text-secondary-300 hover:bg-secondary-950/50 hover:text-white'
							)}
							aria-current={isSelected ? 'true' : undefined}
							onclick={() => (selectedRace = raceId)}
						>
							<img src={resolveFactionFlag(raceId)} alt={raceLabel(raceId)} class="h-3.5 shrink-0" />
							<span class="min-w-0 flex-1 truncate">{raceLabel(raceId)}</span>
						</button>
					{/each}
				</nav>

				<div class="border-secondary-800 bg-secondary-950/50 h-56 w-full p-4" bind:this={target}>
					{#if isInViewport.current && chartData.length > 0}
						<div class="size-full">
							<LineChart
								data={chartData}
								x="at"
								y="rating"
								yNice
								padding={{ left: 20, bottom: 28, right: 56, top: 8 }}
								tooltip={{ mode: 'quadtree' }}
							>
								{#snippet children({ context }: any)}
									<Layer type="svg">
										<Axis placement="left" grid rule />
										<Axis
											placement="bottom"
											rule
											format={(value) => formatAxisDate(value as Date)}
										/>
										<Spline
											data={chartData}
											y="rating"
											class="stroke-primary stroke-2"
											draw={{ duration: 0 }}
										>
											{#snippet endContent()}
												<Circle r={3.5} class="stroke-primary text-primary" />
												<Text
													value={activeRaceLabel}
													verticalAnchor="middle"
													dx={6}
													dy={-2}
													class="text-primary text-[10px]"
												/>
											{/snippet}
										</Spline>
										<Highlight points lines />
									</Layer>
									<Tooltip.Root>
										<Tooltip.Header>
											{context.tooltip.data?.label ?? activeRaceLabel}
										</Tooltip.Header>
										<Tooltip.List>
											<Tooltip.Item
												label={formatTooltipDate(context.tooltip.data?.at as Date)}
												value={formatTooltipRating(context.tooltip.data?.rating ?? 0)}
											/>
										</Tooltip.List>
									</Tooltip.Root>
								{/snippet}
							</LineChart>
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<p class="text-secondary-400 px-4 py-4 text-sm">{emptyModeMessage}</p>
		{/if}
	</div>
{/if}
