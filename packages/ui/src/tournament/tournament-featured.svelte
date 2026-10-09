<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { flushHeaderTitle, interactive } from '@company-of-heroes/ui/variants';
	import BroadcastIcon from 'phosphor-svelte/lib/BroadcastIcon';
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
	import { escapeHtml, tooltip } from '../attachments';
	import { countryDisplayName } from '../format/country';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import PlayerProfileLink from '../player/player-profile-link.svelte';
	import { playerPreviewId } from '../player/player-preview-cache';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import { parseTournamentDate, roundLabel } from './format';
	import type { Tournament, TournamentMatch, TournamentParticipant, TournamentSlot } from './types';
	import { useTournament } from './context';

	const context = useTournament();
	const tournament = $derived(context.tournament);
	const matches = $derived(context.matches);
	const participants = $derived(context.participantsById);
	const { t } = useI18n();
	const host = useHost();

	const running = $derived(tournament.status === 'in_progress');
	const match = $derived(
		running && tournament.featuredMatch
			? matches.find((item) => item.id === tournament.featuredMatch)
			: undefined
	);
	const rounds = $derived(
		match
			? Math.max(0, ...matches.filter((m) => m.bracket === match.bracket).map((m) => m.round))
			: 0
	);
	const startsAt = $derived(
		match?.scheduledAt
			? formatDate(parseTournamentDate(match.scheduledAt), host.locale(), 'dateTime')
			: null
	);
	const stream = $derived(running ? tournament.streamUrl : null);

	function watch(url: string) {
		host.openExternal?.(url);
	}
</script>

{#snippet watchButton(url: string, size: 'sm' | 'md')}
	{#if host.openExternal}
		<Button {size} class="shrink-0" onclick={() => watch(url)}>
			<BroadcastIcon size={16} weight="fill" />
			{t('Watch live')}
		</Button>
	{:else}
		<Button {size} class="shrink-0" href={url} target="_blank" rel="noopener noreferrer">
			<BroadcastIcon size={16} weight="fill" />
			{t('Watch live')}
		</Button>
	{/if}
{/snippet}

{#snippet player(id: string | null, side: TournamentSlot)}
	{@const entry = id ? participants.get(id) : undefined}
	{@const flagUrl = entry ? host.resolve.flagImageUrl(entry.country) : null}
	{@const won = !!match?.winner && match.winner === id}
	<div
		class={cn(
			'flex min-w-0 flex-1 items-center gap-2',
			side === 'B' && 'sm:flex-row-reverse sm:text-right'
		)}
	>
		{#if entry}
			{#if flagUrl}
				<img
					class="h-4 w-auto shrink-0 rounded-xs"
					src={flagUrl}
					alt={countryDisplayName(entry.country, host.locale()) ?? entry.country}
					{@attach tooltip(escapeHtml(countryDisplayName(entry.country, host.locale()) ?? ''))}
				/>
			{/if}
			<PlayerProfileLink
				href={host.routes.player(entry.profileId)}
				playerId={playerPreviewId({ steamId: entry.steamId, profileId: entry.profileId }) ??
					String(entry.profileId)}
				class={cn(
					interactive,
					'hover:text-primary font-heading min-w-0 truncate text-lg font-bold',
					won || !match?.winner ? 'text-white' : 'text-secondary-400'
				)}
			>
				{entry.alias}
			</PlayerProfileLink>
		{:else}
			<span class="text-secondary-500 truncate italic">{t('TBD')}</span>
		{/if}
	</div>
{/snippet}

{#if match}
	<section class="border-secondary-800 from-primary/5 border-b bg-linear-to-r to-transparent">
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3">
			<StarIcon size={14} weight="fill" class="text-primary shrink-0" />
			<p class={flushHeaderTitle}>{t('Featured match')}</p>
			<span class="text-secondary-400 text-xs">
				{roundLabel(t, tournament.format, match, rounds)} · {t('Bo{count}', {
					count: match.bestOf
				})}
			</span>
		</div>
		<div class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
			<div class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
				{@render player(match.playerA, 'A')}
				<div class="flex shrink-0 flex-col items-start gap-1 sm:items-center">
					{#if match.status === 'completed'}
						<span class="font-heading text-2xl font-bold text-white tabular-nums">
							{match.winsA} – {match.winsB}
						</span>
					{:else if match.playing}
						<Badge variant="destructive" pulse>{t('Live')}</Badge>
					{:else if startsAt}
						<span class="text-secondary-300 text-sm">{t('Starts {date}', { date: startsAt })}</span>
					{:else}
						<span class="text-secondary-500 text-sm font-semibold">{t('vs')}</span>
					{/if}
				</div>
				{@render player(match.playerB, 'B')}
			</div>
			{#if stream}
				{@render watchButton(stream, 'md')}
			{/if}
		</div>
	</section>
{:else if stream}
	<section
		class="border-secondary-800 flex flex-wrap items-center gap-3 border-b px-4 py-2.5 text-sm"
	>
		<BroadcastIcon size={16} weight="fill" class="text-destructive shrink-0" />
		<p class="text-secondary-200 min-w-0 flex-1">{t('This tournament is streamed.')}</p>
		{@render watchButton(stream, 'sm')}
	</section>
{/if}
