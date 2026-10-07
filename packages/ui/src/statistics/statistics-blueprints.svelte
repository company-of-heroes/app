<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { factionIcon, interactive, tableHeadText } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import { getRaceLabel } from '../format/player-format';
	import { actionIconKey } from '../replay/action-icons';
	import { percent } from './format';
	import type { StatisticsBlueprint, StatisticsReplayPlayers } from './types';
	import { InfoPopover } from './info-popover.svelte';
	import StatisticsInfoPopover from './statistics-info-popover.svelte';

	type Props = {
		/** Units (per game + share of players), upgrades (share of players) or openings (share of games). */
		kind: 'units' | 'upgrades' | 'openings';
		rows: StatisticsBlueprint[];
		replayPlayers: StatisticsReplayPlayers[];
		class?: string;
	};

	let { kind, rows, replayPlayers, class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const RACES = [0, 2, 1, 3];
	const popover = new InfoPopover();

	function iconUrl(row: StatisticsBlueprint): string | undefined {
		const key = actionIconKey({
			objectID: row.id,
			command: { type: kind === 'upgrades' ? 'UPGRADE' : 'UNIT' }
		});
		return key ? host.resolve.actionIcon(key) : undefined;
	}

	function playersOf(raceId: number): number {
		return replayPlayers.find((entry) => entry.raceId === raceId)?.players ?? 0;
	}
</script>

<div class={cn('bg-secondary-800 grid gap-px sm:grid-cols-2 xl:grid-cols-4', className)}>
	{#each RACES as raceId (raceId)}
		{@const list = rows.filter((row) => row.raceId === raceId)}
		{@const players = playersOf(raceId)}
		<section class="bg-gray-950">
			<h3 class={cn('bg-secondary-950/90 flex items-center gap-2 px-4 py-2.5', tableHeadText)}>
				<img src={host.resolve.factionFlagByRace(raceId)} alt="" class={factionIcon} />
				<!-- Trims the line box to the caps so uppercase text centres on the flag. -->
				<span class="[text-box:trim-both_cap_alphabetic]">{t(getRaceLabel(raceId))}</span>
			</h3>
			{#if list.length === 0}
				<p class="text-secondary-500 border-secondary-800 border-t px-4 py-3 text-sm">-</p>
			{/if}
			<ol>
				{#each list as row (row.id)}
					{@const icon = iconUrl(row)}
					<li class="border-secondary-800 border-t">
						<button
							type="button"
							class={cn(
								interactive,
								'hover:bg-secondary-950/60 flex w-full items-center gap-3 px-4 py-2 text-left transition-colors'
							)}
							{...popover.trigger({
								kind: kind === 'upgrades' ? 'upgrade' : 'unit',
								raceId,
								id: row.id,
								name: row.name
							})}
						>
							{#if icon}
								<img src={icon} alt="" class="size-8 shrink-0 rounded-sm" />
							{:else}
								<span class="bg-secondary-800 size-8 shrink-0 rounded-sm"></span>
							{/if}
							<p class="min-w-0 flex-1 truncate text-sm text-white">{row.name}</p>
							<div class="shrink-0 text-right text-xs tabular-nums">
								{#if kind === 'units'}
									<p class="text-sm font-bold text-white">
										{t('{count} per game', {
											count: players > 0 ? (row.count / players).toFixed(1) : '-'
										})}
									</p>
									<p class="text-secondary-500">
										{t('{share} of players', { share: percent(row.players, players) })}
									</p>
								{:else if kind === 'upgrades'}
									<p class="text-sm font-bold text-white">{percent(row.players, players)}</p>
									<p class="text-secondary-500">{t('of players')}</p>
								{:else}
									<p class="text-sm font-bold text-white">{percent(row.count, players)}</p>
									<p class="text-secondary-500">{t('of games')}</p>
								{/if}
							</div>
						</button>
					</li>
				{/each}
			</ol>
		</section>
	{/each}
</div>

<StatisticsInfoPopover {popover} />
