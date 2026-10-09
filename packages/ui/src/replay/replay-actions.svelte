<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { useI18n } from '@company-of-heroes/i18n';
	import { useHost } from '../host/host.context';
	import * as Tabs from '../ui/tabs';
	import { factionIcon } from '../variants';
	import { raceFromReplayFaction, timelineActions } from './replay-stats';
	import ReplayTimeline from './replay-timeline.svelte';
	import ReplayResourceSpend from './replay-resource-spend.svelte';
	import { useReplayData } from './context';

	const context = useReplayData();
	const replay = $derived(context.replay);
	const host = useHost();
	const { t } = useI18n();

	/** The timeline and the action totals each have their own player tabs. */
	let timelinePlayerId = $state<number | null>(null);
	let totalsPlayerId = $state<number | null>(null);

	/** Player tabs grouped by team (Allies, then Axis), keeping replay order within a team. */
	const tabPlayers = $derived.by(() => {
		const isAllied = (faction: string) => faction.toLowerCase().startsWith('allies');
		const sorted = [
			...replay.players.filter((player) => isAllied(player.faction)),
			...replay.players.filter((player) => !isAllied(player.faction))
		];
		return sorted.map((player, index) => ({
			player,
			teamStart: index === 0 || isAllied(sorted[index - 1].faction) !== isAllied(player.faction)
		}));
	});
	// Default to the first tab (first Allied player), not raw replay order.
	const firstPlayerId = $derived(tabPlayers[0]?.player.id ?? null);
	const timelinePlayer = $derived(timelinePlayerId ?? firstPlayerId);
	const totalsPlayer = $derived(totalsPlayerId ?? firstPlayerId);

	const playerActions = $derived(totalsPlayer == null ? [] : timelineActions(replay, totalsPlayer));

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
			names.set(name, {
				name,
				count: (current?.count ?? 0) + 1
			});
		}
		return [...byType.entries()]
			.map(([type, names]) => ({
				type,
				counts: [...names.values()].sort((a, b) => b.count - a.count)
			}))
			.sort((a, b) => a.type.localeCompare(b.type));
	});

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
</script>

{#snippet playerTabs(selected: number | null, onSelect: (id: number) => void)}
	<Tabs.Root
		value={selected != null ? String(selected) : undefined}
		onValueChange={(value) => {
			if (value) {
				onSelect(Number(value));
			}
		}}
	>
		<!-- Sheet tabs on top of the panel below. The strip's bottom line is an inset shadow so the
			active tab can paint over it (a border would sit outside the scroll clip). -->
		<Tabs.List
			class="bg-secondary-950/60 border-secondary-800 w-full items-end gap-0.5 overflow-x-auto overflow-y-hidden border-t px-3 pt-2 shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)]"
		>
			{#each tabPlayers as { player, teamStart }, i (`${i}-${player.id ?? player.name ?? 'player'}`)}
				{#if teamStart && i > 0}
					<!-- Gap between the Allied and Axis tabs. -->
					<span class="w-5 shrink-0" aria-hidden="true"></span>
				{/if}
				{#if player.id != null}
					<Tabs.Trigger value={String(player.id)} variant="sheet">
						<img
							src={host.resolve.factionFlagByRace(raceFromReplayFaction(player.faction))}
							alt=""
							class={factionIcon}
						/>
						<span class="min-w-0 truncate">{player.name}</span>
					</Tabs.Trigger>
				{/if}
			{/each}
		</Tabs.List>
	</Tabs.Root>
{/snippet}

{@render playerTabs(timelinePlayer, (id) => (timelinePlayerId = id))}

<ReplayTimeline playerId={timelinePlayer} />

<section>
	<div class="px-4 py-2.5">
		<p class="text-secondary-300 text-xs font-semibold tracking-wide uppercase">
			{t('Actions over time')}
		</p>
	</div>
	{@render playerTabs(totalsPlayer, (id) => (totalsPlayerId = id))}
	<!-- Compact totals per action type, flowed into columns so short groups don't leave gaps.
		gray-950 matches the active sheet tab so it flows into this panel. -->
	<div
		class="border-secondary-800 columns-1 gap-8 border-b bg-gray-950 px-4 py-3 sm:columns-2 lg:columns-3"
	>
		{#each ACTION_GROUPS as group (group.type)}
			{@const items = typeItems(group.type)}
			{#if items.length > 0}
				<div class={cn('mb-4 break-inside-avoid', group.color)}>
					<p class="text-secondary-400 mb-1 text-xs font-semibold tracking-wide uppercase">
						{t(group.title)}
					</p>
					{#each items as item, itemIndex (`${group.type}-${item.name}-${itemIndex}`)}
						<div class="flex items-baseline gap-2.5 text-base leading-7">
							{#if group.type !== 'DOCTRINAL'}
								<span class="text-secondary-400 w-9 shrink-0 text-right text-sm tabular-nums">
									{item.count}×
								</span>
							{/if}
							<span class="min-w-0 truncate">{item.name}</span>
						</div>
					{/each}
				</div>
			{/if}
		{/each}
	</div>
</section>

<ReplayResourceSpend players={tabPlayers.map((entry) => entry.player)} />
