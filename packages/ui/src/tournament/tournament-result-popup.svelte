<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import FilmReelIcon from 'phosphor-svelte/lib/FilmReelIcon';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import { onMount } from 'svelte';
	import { getRaceLabel, normalizeMapName } from '../format/player-format';
	import { useHost } from '../host/host.context';
	import { formatDurationSeconds } from '../replay/utils';
	import { Button } from '../ui/button';
	import MapImage from '../ui/map-image.svelte';
	import { modal } from '../ui/modal';
	import { fireConfetti } from './confetti';
	import { roundLabel } from './format';
	import type { TournamentGameResult, TournamentResultPlayer } from './types';

	type Props = { result: TournamentGameResult };

	let { result }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const ordered = $derived(
		[...result.players].sort((a, b) => (a.slot === 'A' ? -1 : 1) - (b.slot === 'A' ? -1 : 1))
	);
	const round = $derived(
		roundLabel(t, result.tournament.format, result.match, result.rounds || result.match.round)
	);
	const headline = $derived(
		result.wonTournament
			? t('You won {name}!', { name: result.tournament.name })
			: result.wonMatch
				? t('You won the match')
				: result.won
					? t('You won game {number}', { number: result.gameNumber })
					: t('You lost game {number}', { number: result.gameNumber })
	);
	const followUp = $derived(
		result.wonTournament
			? t('Your champion medal is now on your profile.')
			: result.wonMatch
				? t('You go through to the next round.')
				: result.match.status === 'completed'
					? t('The match is over. Thanks for playing!')
					: t('Next up: game {number}.', { number: result.gameNumber + 1 })
	);

	onMount(() => {
		fireConfetti(result.won ? 220 : 90);
	});

	function delta(player: TournamentResultPlayer): number | null {
		return player.oldRating != null && player.newRating != null && player.oldRating > 0
			? player.newRating - player.oldRating
			: null;
	}
</script>

<div class="flex flex-col">
	<div class="relative isolate overflow-hidden px-5 pt-6 pb-5 text-center">
		<div
			class={cn(
				'pointer-events-none absolute inset-0 -z-10 bg-radial-[at_50%_0%] to-transparent',
				result.won ? 'from-warning/25' : 'from-secondary-700/30'
			)}
		></div>
		<p class="text-secondary-400 text-sm">
			{result.tournament.name}
			<span class="text-secondary-600 px-1">/</span>
			{round}
		</p>
		<h2
			class={cn(
				'font-heading mt-2 text-3xl leading-tight font-bold',
				result.won ? 'text-warning' : 'text-white'
			)}
		>
			{#if result.wonTournament}
				<TrophyIcon weight="fill" class="text-warning mr-1 inline size-7 align-[-3px]" />
			{/if}
			{headline}
		</h2>
		<p class="text-secondary-300 mt-1 text-sm">{followUp}</p>
	</div>

	<div class="border-secondary-800 flex items-center gap-4 border-y px-5 py-4">
		<div class="flex min-w-0 flex-1 flex-col gap-3">
			{#each ordered as player (player.slot)}
				{@const change = delta(player)}
				{@const mine = player.slot === result.mySlot}
				<div class="flex min-w-0 items-center gap-3">
					{#if player.raceId != null}
						<img
							src={host.resolve.factionFlagByRace(player.raceId)}
							alt={getRaceLabel(player.raceId)}
							title={getRaceLabel(player.raceId)}
							class="h-5 w-auto shrink-0"
						/>
					{/if}
					<span
						class={cn(
							'min-w-0 flex-1 truncate',
							mine ? 'font-semibold text-white' : 'text-secondary-200'
						)}
					>
						{player.alias}
					</span>
					{#if change != null}
						<span
							class={cn('text-xs tabular-nums', change >= 0 ? 'text-success' : 'text-destructive')}
						>
							{player.newRating} ({change >= 0 ? '+' : ''}{change})
						</span>
					{/if}
					<span
						class={cn(
							'w-6 text-center text-xs font-bold',
							player.outcome === 1 ? 'text-success' : 'text-destructive'
						)}
					>
						{player.outcome === 1 ? 'W' : 'L'}
					</span>
				</div>
			{/each}
		</div>
		<div class="border-secondary-800 flex flex-col items-center border-l pl-4">
			<span class="text-secondary-400 text-xs">{t('Score')}</span>
			<span class="font-heading text-2xl font-bold text-white tabular-nums">
				{result.match.winsA} – {result.match.winsB}
			</span>
			<span class="text-secondary-500 text-xs">
				{t('Best of {count}', { count: result.match.bestOf })}
			</span>
		</div>
	</div>

	{#if result.map}
		<div class="border-secondary-800 flex items-center gap-3 border-b px-5 py-3">
			<MapImage map={result.map} class="size-10 shrink-0 rounded" />
			<div class="flex min-w-0 flex-col">
				<span class="truncate text-sm text-white">{normalizeMapName(result.map, false)}</span>
				{#if result.durationSeconds}
					<span class="text-secondary-400 flex items-center gap-1 text-xs tabular-nums">
						<ClockIcon size={12} />
						{formatDurationSeconds(result.durationSeconds)}
					</span>
				{/if}
			</div>
		</div>
	{/if}

	<div class="flex flex-wrap justify-end gap-2 px-5 py-4">
		<Button variant="ghost" onclick={() => modal.close()}>{t('Close')}</Button>
		<Button
			variant="secondary"
			href={host.routes.tournament(result.tournament.slug)}
			onclick={() => modal.close()}
		>
			{t('View tournament')}
		</Button>
		<Button href={host.routes.match(result.lobbyId)} onclick={() => modal.close()}>
			<FilmReelIcon class="size-4" weight="duotone" />
			{t('Watch replay')}
		</Button>
	</div>
</div>
