<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { useI18n } from '@company-of-heroes/i18n';
	import { Axis, Circle, Highlight, Layer, LineChart, Spline, Text, Tooltip } from 'layerchart';
	import { IsInViewport } from 'runed';
	import { curveMonotoneX } from 'd3-shape';
	import { useHost } from '../host/host.context';
	import * as Tabs from '../ui/tabs';
	import {
		chartSeriesColours,
		factionIcon,
		flushHeader,
		flushHeaderTitle,
		tableHeadRow
	} from '../variants';
	import { playerSpend, RESOURCE_COLOURS, type SpentResource } from './replay-costs';
	import { raceFromReplayFaction } from './replay-stats';
	import { formatTimelineClock } from './replay-timeline';
	import type { ReplayPlayer } from './types';
	import { useReplayData } from './context';
	import { tooltip } from '../attachments';

	type Props = {
		/** Players in display order (team-grouped, like the timeline tabs). */
		players: ReplayPlayer[];
	};

	let { players }: Props = $props();
	const context = useReplayData();
	const replay = $derived(context.replay);
	const host = useHost();
	const { t } = useI18n();

	type ChartResource = Exclude<SpentResource, 'command'>;
	const RESOURCES: { value: ChartResource; label: string }[] = [
		{ value: 'manpower', label: 'Manpower' },
		{ value: 'fuel', label: 'Fuel' },
		{ value: 'munition', label: 'Munitions' }
	];

	let resource = $state<ChartResource>('manpower');

	const spend = $derived(playerSpend(replay));
	const duration = $derived(Math.max(1, replay.duration));
	const rows = $derived(
		players
			.filter((player) => player.id != null)
			.map((player, index) => ({
				player,
				color: chartSeriesColours[index % chartSeriesColours.length],
				spend: spend.get(player.id!)
			}))
	);
	const isAllied = (player: ReplayPlayer) => player.faction.toLowerCase().startsWith('allies');
	const teams = $derived(
		[
			{ label: 'Allies', rows: rows.filter((row) => isAllied(row.player)) },
			{ label: 'Axis', rows: rows.filter((row) => !isAllied(row.player)) }
		].filter((team) => team.rows.length > 0)
	);

	/** Samples per line: enough detail, few enough points for a smooth curve. */
	const SAMPLES = 150;

	/**
	 * One line per player, resampled at a fixed interval to the match end (the raw series jumps at
	 * every order) and drawn with a monotone curve, so it is smooth without overshooting totals.
	 */
	const series = $derived(
		rows.map((row) => {
			const raw = row.spend?.series ?? [];
			const step = duration / SAMPLES;
			const points = [];
			let index = 0;
			for (let sample = 0; sample <= SAMPLES; sample++) {
				const second = Math.min(duration, sample * step);
				while (index + 1 < raw.length && raw[index + 1].second <= second) {
					index++;
				}

				points.push({
					second,
					value: raw[index]?.[resource] ?? 0,
					name: row.player.name
				});
			}
			return { ...row, points };
		})
	);
	const chartData = $derived(series.flatMap((line) => line.points));

	const formatAmount = (value: number) => Math.round(value).toLocaleString();
	const formatAxis = (value: number) =>
		value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : String(value);
	const shortName = (name: string) => (name.length > 12 ? `${name.slice(0, 11)}…` : name);
	const resourceIcon = (key: SpentResource) => host.resolve.actionIcon(`resource_${key}`);

	/** Player highlighted by hovering their table row: their line stands out, the others fade. */
	let highlightedId = $state<number | null>(null);
	/** Highlighted line drawn last so it sits on top of the others. */
	const orderedSeries = $derived(
		highlightedId == null
			? series
			: [
					...series.filter((line) => line.player.id !== highlightedId),
					...series.filter((line) => line.player.id === highlightedId)
				]
	);

	let chartTarget = $state<HTMLElement>();
	const chartInView = new IsInViewport(() => chartTarget);
	let chartShown = $state(false);
	$effect(() => {
		if (chartInView.current) {
			chartShown = true;
		}
	});
</script>

<section class="border-secondary-800 border-b">
	<div class={flushHeader}>
		<p class={flushHeaderTitle}>{t('Resources spent')}</p>
	</div>

	<Tabs.Root
		value={resource}
		onValueChange={(value) => {
			if (value) {
				resource = value as ChartResource;
			}
		}}
	>
		<!-- Sheet tabs like the timeline; the active tab joins the gray-950 panel below. -->
		<Tabs.List
			class="bg-secondary-950/60 w-full items-end gap-0.5 overflow-x-auto overflow-y-hidden px-3 pt-2 shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)]"
		>
			{#each RESOURCES as item (item.value)}
				<Tabs.Trigger value={item.value} variant="sheet">
					{#if resourceIcon(item.value)}
						<img src={resourceIcon(item.value)} alt="" class="size-4 shrink-0" />
					{/if}
					<span style:color={item.value === resource ? RESOURCE_COLOURS[item.value] : undefined}>
						{t(item.label)}
					</span>
				</Tabs.Trigger>
			{/each}
		</Tabs.List>
	</Tabs.Root>

	<div class="grid grid-cols-1 bg-gray-950 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
		<!-- Every row keeps its bottom border; -mb-px lets the last one sit on the section's own
			bottom border when the table reaches it, so the line never doubles. -->
		<table class="-mb-px w-full border-collapse self-start text-sm">
			<thead>
				<!-- Transparent so the active sheet tab above flows into the table. -->
				<tr class={cn(tableHeadRow, 'bg-transparent')}>
					<th class="px-4 py-2 text-left">{t('Player')}</th>
					{#each RESOURCES as item (item.value)}
						<th
							class={cn(
								'px-2 py-2 text-right transition-colors',
								item.value === resource && 'bg-white/[0.04]'
							)}
						>
							{#if resourceIcon(item.value)}
								<img src={resourceIcon(item.value)} alt={t(item.label)} class="ml-auto size-4" />
							{:else}
								{t(item.label)}
							{/if}
						</th>
					{/each}
					<th class="px-4 py-2 text-right" {@attach tooltip(t('Command points'))}>{t('CP')}</th>
				</tr>
			</thead>
			<tbody>
				{#each teams as team (team.label)}
					<tr class="bg-secondary-950/60 border-secondary-800 border-b">
						<td
							colspan={RESOURCES.length + 2}
							class="text-secondary-400 px-4 py-1.5 text-[11px] font-semibold tracking-wide uppercase"
						>
							{t(team.label)}
						</td>
					</tr>
					{#each team.rows as row (row.player.id)}
						<tr
							class={cn(
								'border-secondary-800 border-b transition-colors',
								highlightedId === row.player.id && 'bg-white/[0.04]',
								highlightedId != null && highlightedId !== row.player.id && 'opacity-50'
							)}
							onmouseenter={() => (highlightedId = row.player.id)}
							onmouseleave={() => (highlightedId = null)}
						>
							<td class="px-4 py-2">
								<span class="flex min-w-0 items-center gap-3">
									<!-- Matches this player's line in the chart. -->
									<span
										class="h-5 w-1 shrink-0 rounded-full"
										style:background-color={row.color}
										aria-hidden="true"
									></span>
									<img
										src={host.resolve.factionFlagByRace(raceFromReplayFaction(row.player.faction))}
										alt=""
										class={factionIcon}
									/>
									<span class="truncate font-medium text-white">{row.player.name}</span>
								</span>
							</td>
							{#each RESOURCES as item (item.value)}
								<td
									class={cn(
										'px-2 py-2 text-right font-medium tabular-nums transition-colors',
										item.value === resource && 'bg-white/[0.04] font-bold'
									)}
									style:color={RESOURCE_COLOURS[item.value]}
								>
									{formatAmount(row.spend?.totals[item.value] ?? 0)}
								</td>
							{/each}
							<td class="text-secondary-300 px-4 py-2 text-right font-medium tabular-nums">
								{formatAmount(row.spend?.totals.command ?? 0)}
							</td>
						</tr>
					{/each}
				{/each}
			</tbody>
		</table>

		<!-- Stretches to the table's height (min 18rem); the chart fills it absolutely. The divider is
			its left border, so it always runs the full height (the table can be shorter). -->
		<div
			bind:this={chartTarget}
			class="bg-secondary-950/50 border-secondary-800 relative min-h-72 min-w-0 lg:border-l"
		>
			{#if chartShown}
				<div class="absolute inset-4">
					<LineChart
						data={chartData}
						x="second"
						y="value"
						xDomain={[0, duration]}
						yDomain={[0, null]}
						yNice
						padding={{ left: 36, bottom: 28, right: 88, top: 8 }}
						tooltip={{ mode: 'quadtree' }}
					>
						{#snippet children({ context }: any)}
							<Layer type="svg">
								<Axis placement="left" grid rule format={(value) => formatAxis(Number(value))} />
								<Axis
									placement="bottom"
									rule
									tickSpacing={80}
									format={(value) => formatTimelineClock(Number(value))}
								/>
								{#each orderedSeries as line (line.player.id)}
									{@const dimmed = highlightedId != null && highlightedId !== line.player.id}
									<g class={cn('transition-opacity duration-150', dimmed && 'opacity-15')}>
										<Spline
											data={line.points}
											y="value"
											stroke={line.color}
											curve={curveMonotoneX}
											class={highlightedId === line.player.id ? 'stroke-[3]' : 'stroke-2'}
											draw={{ duration: 0 }}
										>
											{#snippet endContent()}
												<Circle r={3} fill={line.color} />
												<Text
													value={shortName(line.player.name)}
													verticalAnchor="middle"
													dx={6}
													fill={line.color}
													class="text-[10px] font-medium"
												/>
											{/snippet}
										</Spline>
									</g>
								{/each}
								<Highlight points lines />
							</Layer>
							<Tooltip.Root>
								<Tooltip.Header>{context.tooltip.data?.name}</Tooltip.Header>
								<Tooltip.List>
									<Tooltip.Item
										label={formatTimelineClock(context.tooltip.data?.second ?? 0)}
										value={formatAmount(context.tooltip.data?.value ?? 0)}
									/>
								</Tooltip.List>
							</Tooltip.Root>
						{/snippet}
					</LineChart>
				</div>
			{/if}
		</div>
	</div>
</section>
