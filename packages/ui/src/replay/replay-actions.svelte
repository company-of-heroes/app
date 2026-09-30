<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { useI18n } from '@company-of-heroes/i18n';
	import { useHost } from '../host/host.context';
	import { countedActions, raceFromReplayFaction } from './replay-stats';
	import type { ReplayAction, ReplayData } from './types';
	import { Axis, ChartClipPath, Highlight, Layer, LineChart, Points, Tooltip } from 'layerchart';

	type Props = {
		replay: ReplayData;
	};

	let { replay }: Props = $props();
	const host = useHost();
	const { t } = useI18n();

	let selectedPlayerId = $state<number | null>(null);
	let visiblePlayerIds = $state<number[]>([]);

	const selected = $derived(selectedPlayerId ?? replay.players[0]?.id ?? null);

	const excludedUnitCommands = new Set([0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xa8]);

	function isChartAction(action: ReplayAction): boolean {
		if (!action.command?.description) {
			return false;
		}

		if (action.command.type === 'AI_TAKEOVER') {
			return false;
		}

		if (
			action.commandID === 0x37 &&
			action.objectID != null &&
			excludedUnitCommands.has(action.objectID)
		) {
			return false;
		}

		return true;
	}

	function dedupeActions(actions: ReplayAction[]): ReplayAction[] {
		const seen = new Set<string>();
		const out: ReplayAction[] = [];
		for (const action of actions) {
			const key = `${action.tick}|${action.commandID ?? 0}|${action.objectID ?? 0}`;
			if (seen.has(key)) {
				continue;
			}

			seen.add(key);
			out.push(action);
		}
		return out;
	}

	const playerActions = $derived.by(() => {
		if (selected == null) {
			return [];
		}

		return dedupeActions(countedActions(replay, selected).filter(isChartAction));
	});

	const grouped = $derived.by(() => {
		const byType = new Map<string, Map<string, { name: string; count: number }>>();
		for (const action of playerActions) {
			const type = action.command?.type || 'OTHER';
			const name = action.command?.name || action.command?.description || type;
			if (!byType.has(type)) {
				byType.set(type, new Map());
			}

			const names = byType.get(type)!;
			const current = names.get(name);
			names.set(name, { name, count: (current?.count ?? 0) + 1 });
		}
		return [...byType.entries()]
			.map(([type, names]) => ({
				type,
				counts: [...names.values()].sort((a, b) => b.count - a.count)
			}))
			.sort((a, b) => a.type.localeCompare(b.type));
	});

	const endSecond = $derived(Math.max(1, Math.ceil(replay.duration)));
	const chartPadding = { left: 40, bottom: 32, right: 8, top: 8 };
	const minSpan = 8;

	let zoomedStart = $state<number | null>(null);
	let zoomedEnd = $state<number | null>(null);

	const viewStart = $derived(zoomedStart ?? 0);
	const viewEnd = $derived(zoomedEnd ?? endSecond);

	const data = $derived.by(() => {
		const result: Array<{
			player: ReplayData['players'][number];
			second: number;
			value: number;
			action: ReplayAction;
		}> = [];
		for (const player of replay.players) {
			if (
				visiblePlayerIds.length > 0 &&
				(player.id == null || !visiblePlayerIds.includes(player.id))
			) {
				continue;
			}

			const actions = dedupeActions(countedActions(replay, player.id).filter(isChartAction));
			const perSecond = new Map<number, number>();
			for (const action of actions) {
				const second = Math.floor(action.tick / 8);
				if (second < 0 || second > endSecond) {
					continue;
				}

				const value = (perSecond.get(second) ?? 0) + 1;
				perSecond.set(second, value);
				result.push({ player, second, value, action });
			}
		}
		return result;
	});

	const colors = [
		'stroke-blue-400 fill-blue-400 text-blue-400',
		'stroke-green-400 fill-green-400 text-green-400',
		'stroke-red-400 fill-red-400 text-red-400',
		'stroke-yellow-400 fill-yellow-400 text-yellow-400',
		'stroke-purple-400 fill-purple-400 text-purple-400',
		'stroke-pink-400 fill-pink-400 text-pink-400',
		'stroke-teal-400 fill-teal-400 text-teal-400',
		'stroke-indigo-400 fill-indigo-400 text-indigo-400'
	];

	const series = $derived(
		replay.players
			.map((player, i) => ({
				key: player.id,
				label: player.name,
				color: colors[i % colors.length],
				dots: data.filter((point) => point.player.id === player.id)
			}))
			.filter((s) => s.dots.length > 0)
	);

	function resetZoom() {
		zoomedStart = null;
		zoomedEnd = null;
	}

	function onChartWheel(event: WheelEvent) {
		event.preventDefault();
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const plotWidth = rect.width - chartPadding.left - chartPadding.right;
		if (plotWidth <= 0) {
			return;
		}

		const ratio = Math.min(
			1,
			Math.max(0, (event.clientX - rect.left - chartPadding.left) / plotWidth)
		);
		const span = viewEnd - viewStart;
		const focus = viewStart + ratio * span;
		const nextSpan = Math.min(endSecond, Math.max(minSpan, span * Math.exp(event.deltaY * 0.002)));
		let nextStart = focus - ratio * nextSpan;
		let nextEnd = nextStart + nextSpan;
		if (nextStart < 0) {
			nextStart = 0;
			nextEnd = nextSpan;
		}

		if (nextEnd > endSecond) {
			nextEnd = endSecond;
			nextStart = Math.max(0, endSecond - nextSpan);
		}

		if (nextStart <= 0 && nextEnd >= endSecond) {
			resetZoom();
			return;
		}

		zoomedStart = nextStart;
		zoomedEnd = nextEnd;
	}

	function formatClock(seconds: number) {
		const total = Math.max(0, Math.round(seconds));
		const minutes = Math.floor(total / 60);
		const rest = total % 60;
		return `${minutes}:${rest.toString().padStart(2, '0')}`;
	}

	function typeItems(type: string) {
		return grouped.find((item) => item.type === type)?.counts ?? [];
	}

	const ACTION_GROUPS = [
		{ title: 'Buildings', type: 'BUILDING', color: 'text-green-200' },
		{ title: 'Units', type: 'UNIT', color: 'text-green-400' },
		{ title: 'Unit commands', type: 'UNIT_COMMAND', color: 'text-blue-300' },
		{ title: 'Upgrades', type: 'UPGRADE', color: 'text-purple-300' },
		{ title: 'Special abilities', type: 'SPECIAL_ABILITY', color: 'text-yellow-200' },
		{ title: 'Doctrine', type: 'DOCTRINAL', color: 'text-primary-200' }
	] as const;

	function commandColor(action: ReplayAction) {
		const type = action.command?.type;
		if (type === 'MOVE_COMMAND') {
			return 'text-blue-400';
		}

		if (type === 'BUILDING') {
			return 'text-green-200';
		}

		if (type === 'UNIT') {
			return 'text-green-400';
		}

		if (type === 'DOCTRINAL') {
			return 'text-primary-200';
		}

		if (type === 'AI_TAKEOVER') {
			return 'text-red-400';
		}

		return 'text-secondary-200';
	}
</script>

<section>
	<div class="border-secondary-800 flex flex-col gap-3 border-b px-4 py-3">
		<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">
			Actions per second
		</p>
		<div class="flex flex-wrap gap-x-4 gap-y-2">
			{#each replay.players as player, i (`${player.id ?? player.name}-${i}`)}
				<label class={cn(interactive, 'text-secondary-300 flex items-center gap-2 text-sm')}>
					<input
						type="checkbox"
						class="accent-primary"
						checked={player.id != null && visiblePlayerIds.includes(player.id)}
						onchange={() => {
							const id = player.id;
							if (id == null) {
								return;
							}

							if (visiblePlayerIds.includes(id)) {
								visiblePlayerIds = visiblePlayerIds.filter((value) => id !== value);
							} else {
								visiblePlayerIds = [...visiblePlayerIds, id];
							}
						}}
					/>
					<span class={colors[i % colors.length]}>{player.name}</span>
				</label>
			{/each}
		</div>
	</div>
	<div class="border-secondary-800 bg-secondary-950/50 h-54 w-full overflow-hidden border-b p-4">
		<div
			class="size-full overscroll-contain"
			role="region"
			aria-label="Replay actions chart. Scroll to zoom, double-click to reset."
			onwheel={onChartWheel}
			ondblclick={resetZoom}
		>
			<LineChart
				{data}
				x="second"
				y="value"
				xDomain={[viewStart, viewEnd]}
				yDomain={[0, null]}
				yNice
				padding={chartPadding}
				tooltip={{ mode: 'quadtree' }}
			>
				{#snippet children({ context }: any)}
					<Layer type="svg">
						<Axis placement="left" grid rule format="integer" />
						<Axis
							placement="bottom"
							rule
							tickSpacing={72}
							format={(value) => formatClock(Number(value))}
						/>
						<ChartClipPath>
							{#each series as s, i (`${s.key ?? s.label}-${i}`)}
								{@const active = s.key === context.tooltip.data?.player?.id || s.key === selected}
								<g class={cn(!active && 'opacity-20 saturate-0')}>
									<Points data={s.dots} y="value" r={2} strokeWidth={0} class={s.color} />
								</g>
							{/each}
							<Highlight points />
						</ChartClipPath>
					</Layer>
					<Tooltip.Root>
						<Tooltip.Header>{context.tooltip.data?.player?.name}</Tooltip.Header>
						<Tooltip.List>
							<Tooltip.Item
								value={context.tooltip.data?.action?.command?.description ?? ''}
								label={context.tooltip.data?.action?.timestamp ??
									formatClock(context.tooltip.data?.second ?? 0)}
							/>
						</Tooltip.List>
					</Tooltip.Root>
				{/snippet}
			</LineChart>
		</div>
	</div>
</section>

<section>
	<div class="border-secondary-800 border-b px-4 py-2.5">
		<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">
			Actions over time
		</p>
	</div>
	<div class="grid min-h-0 grid-cols-1 items-stretch md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
		<nav
			class="border-secondary-800 divide-secondary-800 divide-y md:border-r"
			aria-label="Select player"
		>
			{#each replay.players as player, i (`${i}-${player.id ?? player.name ?? 'player'}`)}
				<button
					type="button"
					class={cn(
						interactive,
						'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors',
						selected === player.id
							? 'bg-secondary-950/80 text-primary font-medium'
							: 'text-secondary-300 hover:bg-secondary-950/50 hover:text-white'
					)}
					aria-current={selected === player.id ? 'true' : undefined}
					onclick={() => (selectedPlayerId = player.id ?? null)}
				>
					<img
						src={host.resolve.factionFlagByRace(raceFromReplayFaction(player.faction))}
						alt=""
						class="h-3.5 shrink-0"
					/>
					<span class="min-w-0 flex-1 truncate">{player.name}</span>
				</button>
			{/each}
		</nav>
		<div class="flex min-h-0 min-w-0 flex-col">
			<div
				class="bg-secondary-950/50 border-secondary-800 grid grid-cols-1 gap-4 border-b px-4 py-4 sm:grid-cols-2 sm:gap-6"
			>
				{#each ACTION_GROUPS as group (group.type)}
					<div class={group.color}>
						<p class="text-secondary-400 mb-2 text-xs font-semibold tracking-wide uppercase">
							{t(group.title)}
						</p>
						{#each typeItems(group.type) as item, itemIndex (`${group.type}-${item.name}-${itemIndex}`)}
							<div
								class={cn(
									'grid text-sm',
									group.type !== 'DOCTRINAL'
										? 'grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2'
										: 'grid-cols-1'
								)}
							>
								{#if group.type !== 'DOCTRINAL'}
									<span class="text-secondary-400 tabular-nums">{item.count}x</span>
								{/if}
								<span class="min-w-0 truncate">{item.name}</span>
							</div>
						{/each}
					</div>
				{/each}
			</div>
			<div class="bg-secondary-950/50 flex max-h-[32rem] min-h-0 flex-col overflow-auto">
				{#each playerActions as action, index (index)}
					<div
						class="border-secondary-800 grid grid-cols-[4rem_minmax(0,auto)_1fr] items-start gap-x-3 border-b px-4 py-2 last:border-b-0"
					>
						<span class="text-secondary-500 text-xs tabular-nums">{action.timestamp}</span>
						<span class={cn('text-sm', commandColor(action))}>{action.command?.description}</span>
						<span class="text-secondary-500 text-xs">({action.command?.type})</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
</section>

<style>
	:global(.lc-axis-tick-label),
	:global(.lc-axis-tick-label tspan) {
		stroke: none !important;
		stroke-width: 0 !important;
		fill: var(--color-secondary-300) !important;
		font-size: 12px !important;
		font-weight: 500 !important;
	}
</style>
