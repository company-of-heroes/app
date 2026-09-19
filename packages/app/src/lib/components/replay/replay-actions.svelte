<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useReplay } from '.';
	import { cn, getFactionFlagFromRace } from '$lib/utils';
	import { groupBy, isEmpty } from 'lodash-es';
	import { Axis, Circle, Highlight, Layer, LineChart, Spline, Text, Tooltip } from 'layerchart';
	import { IsInViewport } from 'runed';
	import { Checkbox } from '../ui/input';
	import { interactive, mePlayerText } from '../ui/variants';
	import { isMeReplayAlias } from '$lib/utils/player-me';
	import { H } from '../ui/h';
	import { useI18n } from '$lib/i18n';

	type Props = HTMLAttributes<HTMLDivElement> & {
		flush?: boolean;
	};

	let { flush = false, ...restProps }: Props = $props();
	const { t } = useI18n();
	const replay = $derived(useReplay());

	let selectedPlayerValue = $state('');
	let filteredPlayers = $state<number[]>([]);

	const selectedPlayer = $derived(selectedPlayerValue ? Number(selectedPlayerValue) : null);

	$effect(() => {
		if (!selectedPlayerValue && replay.players[0]?.id) {
			selectedPlayerValue = String(replay.players[0].id);
		}
	});

	const excludedUnitCommands = new Set([0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xa8]);

	function isCpmChartAction(a: (typeof replay.actions)[number]): boolean {
		if (!a.command || isEmpty(a.command.description)) return false;
		if (a.command.type === 'AI_TAKEOVER') return false;
		if (a.commandID === 0x37 && excludedUnitCommands.has(a.objectID)) return false;
		return true;
	}

	function dedupeCpmActions(actions: (typeof replay.actions)[number][]) {
		const seen = new Set<string>();
		const out = [];
		for (const a of actions) {
			const key = `${a.tick}|${a.commandID}|${a.objectID}`;
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(a);
		}
		return out;
	}

	const actions = $derived.by(() => {
		if (!selectedPlayer) return [];

		const playerActions = replay.actions.filter(
			(a) => a.playerID === selectedPlayer && isCpmChartAction(a)
		);
		const aiTakeOverIndex = replay.actions
			.filter((a) => a.playerID === selectedPlayer)
			.findIndex((a) => a.command?.type === 'AI_TAKEOVER');

		const raw =
			aiTakeOverIndex !== -1
				? replay.actions
						.filter((a) => a.playerID === selectedPlayer)
						.slice(0, aiTakeOverIndex)
						.filter(isCpmChartAction)
				: playerActions;

		return dedupeCpmActions(raw);
	});

	const data = $derived.by(() => {
		const maxMinute = Math.ceil(replay.duration / 60);
		const endMinute = Math.max(1, maxMinute - 3);
		const result = [];

		for (const player of replay.players) {
			const playerRaw = replay.actions.filter((a) => a.playerID === player.id);
			const aiTakeOverIndex = playerRaw.findIndex((a) => a.command?.type === 'AI_TAKEOVER');
			const window =
				aiTakeOverIndex !== -1 ? playerRaw.slice(0, aiTakeOverIndex) : playerRaw;
			const effectiveActions = dedupeCpmActions(window.filter(isCpmChartAction));

			const grouped = groupBy(effectiveActions, (a) => Math.floor(a.tick / 8 / 60));

			for (let i = 0; i < endMinute; i++) {
				result.push({
					player,
					minute: i,
					value: grouped[i]?.length ?? 0
				});
			}
		}

		return result.filter((s) =>
			filteredPlayers.length > 0 ? filteredPlayers.includes(s.player.id!) : true
		);
	});

	const colors = [
		'stroke-blue-400',
		'stroke-green-400',
		'stroke-red-400',
		'stroke-yellow-400',
		'stroke-purple-400',
		'stroke-pink-400',
		'stroke-teal-400',
		'stroke-indigo-400'
	];

	const series = $derived(
		replay.players
			.map((player, i) => ({
				key: player.id,
				label: player.name,
				value: player.name,
				color: colors[i % colors.length],
				data: data.filter((d) => d.player.id === player.id)
			}))
			.filter((s) => (filteredPlayers.length > 0 ? filteredPlayers.includes(s.key!) : true))
	);

	const aggregatedGroups = $derived.by(() => {
		const groups = groupBy(actions, (a) => a.command?.type);
		return Object.entries(groups)
			.map(([type, acts]) => {
				const counts = Object.values(groupBy(acts, (a) => a.command?.name)).map((group) => ({
					command: group[0].command,
					count: group.length
				}));
				counts.sort((a, b) => b.count - a.count);
				return { type, counts };
			})
			.sort((a, b) => a.type.localeCompare(b.type));
	});

	let target = $state<HTMLElement>();
	let isInViewport = new IsInViewport(() => target);

	const sectionTitle = $derived(
		flush
			? 'text-secondary-300 text-xs font-semibold tracking-wide uppercase'
			: 'text-secondary-300'
	);
</script>

{#snippet group(title: string, type: string, color: string)}
	<div class={color}>
		<p class={cn(flush ? 'text-secondary-400 mb-2 text-xs font-semibold tracking-wide uppercase' : 'mb-2 font-semibold')}>
			{title}
		</p>
		{#each aggregatedGroups.find((a) => a.type === type)?.counts ?? [] as item (item.command?.name)}
			<div
				class={cn(
					'grid text-sm',
					type !== 'DOCTRINAL' ? 'grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2' : 'grid-cols-1'
				)}
			>
				{#if type !== 'DOCTRINAL'}
					<span class="text-secondary-400 tabular-nums">{item.count}x</span>
				{/if}
				<span class="min-w-0 truncate">{item.command?.name}</span>
			</div>
		{/each}
	</div>
{/snippet}

<div {...restProps} class={cn('flex flex-col', flush ? '' : 'gap-4', restProps.class)}>
	<section>
		<div
			class={cn(
				flush
					? 'border-secondary-800 flex flex-col gap-3 border-b px-4 py-3'
					: 'flex flex-col gap-3'
			)}
		>
			{#if flush}
				<p class={sectionTitle}>{t('CPM over time')}</p>
			{:else}
				<H level="5" class={sectionTitle}>{t('CPM Over Time')}</H>
			{/if}
			<div class="flex flex-wrap gap-x-4 gap-y-2">
				{#each replay.players as player, i (`${player.id ?? player.name ?? 'player'}-${i}`)}
					<Checkbox
						size="sm"
						label={player.name}
						checked={filteredPlayers.includes(player.id!)}
						onCheckedChange={() => {
							if (filteredPlayers.includes(player.id!)) {
								filteredPlayers = filteredPlayers.filter((p) => p !== player.id!);
							} else {
								filteredPlayers = [...filteredPlayers, player.id!];
							}
						}}
					/>
				{/each}
			</div>
		</div>

		<div
			class={cn(
				'h-54 w-full p-4',
				flush
					? 'border-secondary-800 bg-secondary-950/50 border-b'
					: 'border-secondary-800 rounded-xl border'
			)}
			bind:this={target}
		>
			{#if isInViewport.current}
				<div class="size-full">
					<LineChart
						{data}
						x="minute"
						y="value"
						yDomain={[0, null]}
						yNice
						padding={{ left: 16, bottom: 24, right: 48 }}
						tooltip={{ mode: 'quadtree' }}
					>
						{#snippet children({ context })}
							<Layer type="svg">
								<Axis placement="left" grid rule />
								<Axis placement="bottom" rule />
								{#each series as s, i (s.key + '-' + i)}
									{@const active =
										s.key === context.tooltip.data?.player?.id || s.key === selectedPlayer}
									<g class={cn(!active && 'opacity-20 saturate-0')}>
										<Spline
											data={s.data}
											y="value"
											class={cn('stroke-2', s.color)}
											draw={{ duration: 0 }}
										>
											{#snippet endContent()}
												<Circle r={4} class={s.color} />
												<Text
													value={s.label}
													verticalAnchor="middle"
													dx={6}
													dy={-2}
													class={cn('text-xs', s.color)}
												/>
											{/snippet}
										</Spline>
									</g>
								{/each}
								<Highlight points lines />
							</Layer>
							<Tooltip.Root>
								<Tooltip.Header>{context.tooltip.data?.player?.name}</Tooltip.Header>
								<Tooltip.List>
									<Tooltip.Item
										value={`${context.tooltip.data?.value} CPM`}
										label={`${context.tooltip.data?.minute} min`}
									/>
								</Tooltip.List>
							</Tooltip.Root>
						{/snippet}
					</LineChart>
				</div>
			{/if}
		</div>
	</section>

	<section class="flex min-h-0 flex-col">
		<div class={cn(flush ? 'border-secondary-800 border-b px-4 py-2.5' : 'mt-4')}>
			{#if flush}
				<p class={sectionTitle}>{t('Actions over time')}</p>
			{:else}
				<H level="5" class={sectionTitle}>{t('Actions Over Time')}</H>
			{/if}
		</div>

		<div
			class={cn(
				'grid min-h-0 items-stretch',
				flush
					? 'grid-cols-[minmax(0,13rem)_minmax(0,1fr)]'
					: 'border-secondary-800 grid-cols-[minmax(0,13rem)_auto] gap-4 rounded-xl border p-4'
			)}
		>
			<nav
				class={cn(
					'flex h-full min-h-0 flex-col',
					flush
						? 'border-secondary-800 divide-secondary-800 divide-y border-r'
						: 'bg-secondary-800/30 h-fit gap-0.5 rounded-xl p-2'
				)}
				aria-label={t('Select player')}
			>
				{#each replay.players as player, i (`${player.id ?? player.name ?? 'player'}-${i}`)}
					{@const isSelected = selectedPlayerValue === String(player.id)}
					<button
						type="button"
						class={cn(
							interactive,
							'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors',
							flush ? '' : 'rounded-md',
							isSelected
								? 'bg-secondary-950/80 text-primary font-medium'
								: 'text-secondary-300 hover:bg-secondary-950/50 hover:text-white'
						)}
						aria-current={isSelected ? 'true' : undefined}
						onclick={() => (selectedPlayerValue = String(player.id))}
					>
						<img
							src={getFactionFlagFromRace(
								player.faction as
									| 'allies'
									| 'axis'
									| 'allies_commonwealth'
									| 'axis_panzer_elite'
							)}
							alt={player.faction}
							class="h-3.5 shrink-0"
						/>
						<span class={cn('min-w-0 flex-1 truncate', isMeReplayAlias(player.name) && mePlayerText)}>
							{player.name}
						</span>
					</button>
				{/each}
			</nav>

			<div class="flex min-h-0 min-w-0 flex-col">
				<div
					class={cn(
						'grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2 sm:gap-6',
						flush
							? 'bg-secondary-950/50 border-secondary-800 border-b'
							: 'bg-secondary-800/30 overflow-auto rounded-xl'
					)}
				>
					{@render group(t('Buildings'), 'BUILDING', 'text-green-200')}
					{@render group(t('Units'), 'UNIT', 'text-green-400')}
					{@render group(t('Unit commands'), 'UNIT_COMMAND', 'text-blue-300')}
					{@render group(t('Upgrades'), 'UPGRADE', 'text-purple-300')}
					{@render group(t('Special abilities'), 'SPECIAL_ABILITY', 'text-yellow-200')}
					{@render group(t('Doctrine'), 'DOCTRINAL', 'text-primary-200')}
				</div>

				<div
					class={cn(
						'flex min-h-0 flex-col overflow-auto',
						flush ? 'bg-secondary-950/50 max-h-125' : 'bg-secondary-800/30 max-h-125 rounded-xl px-4 py-2'
					)}
				>
					{#each actions as action, index (index)}
						<div
							class={cn(
								'grid grid-cols-[4rem_minmax(0,auto)_1fr] items-start gap-x-3 px-4 py-2',
								flush && 'border-secondary-800 border-b last:border-b-0'
							)}
						>
							<span class="text-secondary-500 text-xs tabular-nums">{action.timestamp}</span>
							<span
								class={cn(
									'text-sm',
									action.command?.type === 'MOVE_COMMAND' && 'text-blue-400',
									action.command?.type === 'BUILDING' && 'text-green-200',
									action.command?.type === 'UNIT' && 'text-green-400',
									action.command?.type === 'DOCTRINAL' && 'text-primary-200',
									action.command?.type === 'AI_TAKEOVER' && 'text-destructive'
								)}
							>
								{action.command?.description}
							</span>
							<span class="text-secondary-500 text-xs">({action.command?.type})</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</section>
</div>
