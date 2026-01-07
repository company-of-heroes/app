<script lang="ts">
	import { useReplay } from '.';
	import { cn, getFactionFlagFromRace } from '$lib/utils';
	import { groupBy, isEmpty } from 'lodash-es';
	import { Axis, Circle, Highlight, Layer, LineChart, Spline, Text, Tooltip } from 'layerchart';
	import { IsInViewport } from 'runed';
	import { Checkbox } from '../ui/input';
	import { H } from '../ui/h';

	const replay = $derived(useReplay());

	let selectedPlayer = $derived(replay.players.length > 0 ? replay.players[0].name : null);
	let filteredPlayers = $state<string[]>([]);

	let actions = $derived.by(() => {
		if (!selectedPlayer) return [];

		const actions = replay.actions.filter(
			(a) => a.playerName === selectedPlayer && a.command && !isEmpty(a.command.description)
		);
		const aiTakeOverIndex = actions.findIndex((a) => a.command?.type === 'AI_TAKEOVER');

		if (aiTakeOverIndex !== -1) {
			return actions.slice(0, aiTakeOverIndex + 1);
		}

		return actions;
	});

	const data = $derived.by(() => {
		const maxMinute = Math.ceil(replay.duration / 60);
		const endMinute = Math.max(1, maxMinute - 3);
		const result = [];

		for (const player of replay.players) {
			const playerActions = replay.actions.filter(
				(a) => a.playerName === player.name && a.command && !isEmpty(a.command.description)
			);
			const aiTakeOverIndex = playerActions.findIndex((a) => a.command?.type === 'AI_TAKEOVER');
			const effectiveActions =
				aiTakeOverIndex !== -1 ? playerActions.slice(0, aiTakeOverIndex + 1) : playerActions;

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
			filteredPlayers.length > 0 ? filteredPlayers.includes(s.player.name) : true
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
				key: player.name,
				label: player.name,
				value: player.name,
				color: colors[i % colors.length],
				data: data.filter((d) => d.player.name === player.name)
			}))
			.filter((s) => (filteredPlayers.length > 0 ? filteredPlayers.includes(s.key) : true))
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
</script>

{#snippet group(title: string, type: string, color: string)}
	<div class={color}>
		<H level="6" class="mb-2">{title}</H>
		{#each aggregatedGroups.find((a) => a.type === type)?.counts as item}
			<div class={cn('grid', type !== 'DOCTRINAL' ? 'grid-cols-[40px_auto]' : 'grid-cols-[auto]')}>
				{#if type !== 'DOCTRINAL'}
					<span class="truncate">{item.count}x</span>
				{/if}
				<span>{item.command?.name}</span>
			</div>
		{/each}
	</div>
{/snippet}

<H level="5" class="text-secondary-300">CPM Over Time</H>
<div class="flex gap-4">
	{#each replay.players as player}
		<Checkbox
			size="sm"
			label={player.name}
			checked={filteredPlayers.includes(player.name)}
			onCheckedChange={() => {
				if (filteredPlayers.includes(player.name)) {
					filteredPlayers = filteredPlayers.filter((p) => p !== player.name);
				} else {
					filteredPlayers = [...filteredPlayers, player.name];
				}
			}}
		/>
	{/each}
</div>
{#key isInViewport.current}
	<div class="border-secondary-800 h-54 rounded-xl border p-4" bind:this={target}>
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
					{#each series as s (s.key)}
						{@const active =
							s.key === context.tooltip.data?.player?.name || s.key === selectedPlayer}
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
{/key}

<H level="5" class="text-secondary-300 mt-4">Actions Over Time</H>
<div class="border-secondary-800 grid grid-cols-[220px_auto] gap-4 rounded-xl border p-4">
	<div class="flex flex-col gap-[4px]">
		{#each replay.players as player, i (player.name)}
			<button
				class={cn(
					'flex items-center gap-2',
					'cursor-pointer rounded-md px-4 py-1.5 text-start font-bold',
					'text-secondary-600 bg-secondary-950/80',
					'hover:text-secondary-500',
					'data-[active=true]:text-primary data-[active=true]:bg-secondary-800'
				)}
				data-active={selectedPlayer === player.name}
				onclick={() => (selectedPlayer = player.name)}
			>
				<img
					src={getFactionFlagFromRace(
						player.faction as 'allies' | 'axis' | 'allies_commonwealth' | 'axis_panzer_elite'
					)}
					alt={player.faction}
					class="h-4"
				/>
				<span class="truncate">{player.name}</span>
			</button>
		{/each}
	</div>
	<div class="flex flex-col gap-4">
		<div
			class={cn(
				'bg-secondary-800/30 overflow-auto rounded-xl',
				'flex grow flex-col gap-1 px-4 py-4',
				'grid grid-cols-2 gap-6'
			)}
		>
			<div>
				{@render group('BUILDINGS', 'BUILDING', 'text-green-200')}
			</div>
			<div>
				{@render group('UNITS', 'UNIT', 'text-green-400')}
			</div>
			<div>
				{@render group('UNIT COMMANDS', 'UNIT_COMMAND', 'text-blue-300')}
			</div>
			<div>
				{@render group('UPGRADES', 'UPGRADE', 'text-purple-300')}
			</div>
			<div>
				{@render group('SPECIAL ABILITIES', 'SPECIAL_ABILITY', 'text-yellow-200')}
			</div>
			<div>
				{@render group('DOCTRINALS', 'DOCTRINAL', 'text-primary-200')}
			</div>
		</div>
		<div
			class="bg-secondary-800/30 flex max-h-125 grow flex-col gap-1 overflow-auto rounded-xl px-4 py-2"
		>
			<div class="flex flex-col">
				{#each actions as action, index (index)}
					<div class="grid grid-cols-[4rem_auto_1fr] gap-2 py-0.5 last:pb-0">
						<span class="flex items-center text-sm text-gray-200">{action.timestamp}</span>
						<span
							class={cn(
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
</div>
