<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { factionIcon, interactive } from '@company-of-heroes/ui/variants';
	import { formatRelative } from '../format/date';
	import { getModeLabel, getRaceLabel, normalizeMapName } from '../format/player-format';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import type { HeadToHeadGame } from './types';

	type Props = {
		games: HeadToHeadGame[];
	};

	let { games }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
</script>

{#snippet flag(raceId: number | null)}
	{#if raceId != null}
		<img
			src={host.resolve.factionFlagByRace(raceId)}
			alt={getRaceLabel(raceId)}
			title={getRaceLabel(raceId)}
			class={factionIcon}
		/>
	{/if}
{/snippet}

<div class="bg-secondary-950/50">
	{#if games.length === 0}
		<p class="text-secondary-400 px-4 py-2 text-sm">{t('No matches found.')}</p>
	{:else}
		<!-- Rows close themselves; -mb-px lands the last line on the detail row's border. -->
		<ul class="-mb-px">
			{#each games as game (game.lobbyId)}
				<li class="border-secondary-800 border-b">
					<a
						href={host.routes.match(game.lobbyId)}
						class={cn(
							interactive,
							'hover:bg-secondary-900/60 flex min-w-0 items-center gap-2 px-4 py-1.5 transition-colors'
						)}
					>
						<Badge variant={game.won ? 'success' : 'destructive'} class="shrink-0">
							{game.won ? 'W' : 'L'}
						</Badge>
						<span class="min-w-0 flex-1 truncate text-white">
							{game.map ? normalizeMapName(game.map, false) : t('Unknown map')}
						</span>
						<span class="flex shrink-0 items-center gap-1.5">
							{@render flag(game.raceId)}
							<span class="text-secondary-500 text-xs">{t('vs')}</span>
							{@render flag(game.theirRaceId)}
						</span>
						{#if game.matchtypeId != null}
							<span class="text-secondary-300 hidden w-12 shrink-0 text-xs @sm:inline">
								{getModeLabel(game.matchtypeId)}
							</span>
						{/if}
						{#if game.createdAt}
							<span class="text-secondary-400 w-20 shrink-0 text-right text-xs tabular-nums">
								{formatRelative(new Date(game.createdAt).getTime() / 1000, host.locale())}
							</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>
