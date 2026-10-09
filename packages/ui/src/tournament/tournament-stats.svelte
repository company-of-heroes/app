<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderTitle,
		interactive,
		tableHeadText
	} from '@company-of-heroes/ui/variants';
	import ChartBarIcon from 'phosphor-svelte/lib/ChartBarIcon';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import FilmReelIcon from 'phosphor-svelte/lib/FilmReelIcon';
	import FlagIcon from 'phosphor-svelte/lib/FlagIcon';
	import SwordIcon from 'phosphor-svelte/lib/SwordIcon';
	import { escapeHtml, tooltip } from '../attachments';
	import { countryDisplayName } from '../format/country';
	import { getRaceLabel, normalizeMapName } from '../format/player-format';
	import { useHost } from '../host/host.context';
	import { formatDurationSeconds } from '../replay/utils';
	import { Button } from '../ui/button';
	import MapImage from '../ui/map-image.svelte';
	import { Skeleton } from '../ui/skeleton';
	import { roundLabel } from './format';
	import type {
		Tournament,
		TournamentMatch,
		TournamentParticipant,
		TournamentStatGame,
		TournamentStats
	} from './types';
	import { useTournament } from './context';

	const context = useTournament();
	const tournament = $derived(context.tournament);
	const participants = $derived(context.participants);
	const matches = $derived(context.matches);
	const { t } = useI18n();
	const host = useHost();

	const stats = $derived(host.api.tournaments.stats(tournament.slug));
	const byId = $derived(new Map(participants.map((p) => [p.id, p])));
	const matchById = $derived(new Map(matches.map((m) => [m.id, m])));

	function rounds(bracket: TournamentMatch['bracket']) {
		return Math.max(0, ...matches.filter((m) => m.bracket === bracket).map((m) => m.round));
	}

	function playTime(seconds: number) {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		return hours > 0 ? t('{hours}h {minutes}m', { hours, minutes }) : t('{minutes}m', { minutes });
	}

	function percent(wins: number, picks: number) {
		return picks > 0 ? `${Math.round((wins / picks) * 100)}%` : '—';
	}

	function notable(stats: TournamentStats) {
		return [
			stats.longest && { key: 'longest', label: t('Longest game'), game: stats.longest, sub: null },
			stats.shortest && {
				key: 'shortest',
				label: t('Shortest game'),
				game: stats.shortest,
				sub: null
			},
			stats.upset && {
				key: 'upset',
				label: t('Biggest upset'),
				game: stats.upset as TournamentStatGame,
				sub: t('Seed {winner} beat seed {loser}', {
					winner: stats.upset.winnerSeed,
					loser: stats.upset.loserSeed
				})
			}
		].filter((item) => !!item);
	}
</script>

{#snippet name(id: string | null, className = '')}
	{@const player = id ? byId.get(id) : undefined}
	{@const flagUrl = player ? host.resolve.flagImageUrl(player.country) : null}
	{#if player}
		<span class={cn('inline-flex min-w-0 items-center gap-2', className)}>
			{#if flagUrl}
				<img
					class="h-4 w-auto shrink-0 rounded-xs"
					src={flagUrl}
					alt={countryDisplayName(player.country, host.locale()) ?? player.country}
					{@attach tooltip(escapeHtml(countryDisplayName(player.country, host.locale()) ?? ''))}
				/>
			{/if}
			<a
				href={host.routes.player(player.profileId)}
				class={cn(interactive, 'hover:text-primary truncate')}
			>
				{player.alias}
			</a>
		</span>
	{:else}
		<span class="text-secondary-500 italic">{t('TBD')}</span>
	{/if}
{/snippet}

{#snippet fact(label: string, Icon: typeof SwordIcon, value: string)}
	<div
		class="border-secondary-800 flex min-w-36 flex-1 basis-40 flex-col gap-1 border-r border-b px-4 py-3"
	>
		<span class={cn(tableHeadText, 'text-secondary-400 flex items-center gap-1.5')}>
			<Icon size={14} weight="fill" class="text-secondary-500" />
			{label}
		</span>
		<span class="font-heading text-xl font-bold text-white tabular-nums">{value}</span>
	</div>
{/snippet}

{#snippet header(title: string)}
	<div class={flushHeader}>
		<p class={flushHeaderTitle}>{title}</p>
	</div>
{/snippet}

{#await stats}
	<div class="overflow-hidden">
		<div class="-mr-px flex flex-wrap">
			{#each [0, 1, 2, 3] as index (index)}
				<div
					class="border-secondary-800 flex min-w-36 flex-1 basis-40 flex-col gap-2 border-r border-b px-4 py-3"
				>
					<Skeleton class="h-3 w-20" />
					<Skeleton class="h-6 w-12" />
				</div>
			{/each}
		</div>
	</div>
	{#each [0, 1, 2] as index (index)}
		<div class="border-secondary-800 flex items-center gap-3 border-b px-4 py-3">
			<Skeleton class="size-8 shrink-0" />
			<Skeleton class="h-4 flex-1" />
		</div>
	{/each}
{:then stats}
	{@const notableGames = notable(stats)}
	<!-- Facts draw their own right and bottom line; the wrapper clips the outer right line. -->
	<div class="overflow-hidden">
		<div class="-mr-px flex flex-wrap">
			{@render fact(t('Games'), SwordIcon, String(stats.games))}
			{@render fact(t('Matches'), ChartBarIcon, String(stats.matches))}
			{@render fact(t('Total play time'), ClockIcon, playTime(stats.totalSeconds))}
			{@render fact(t('Walkovers'), FlagIcon, String(stats.walkovers))}
		</div>
	</div>

	{#if stats.factions.length}
		{@render header(t('Factions'))}
		<table class="w-full text-sm">
			<thead>
				<tr class="border-secondary-800 border-b">
					<th class={cn(tableHeadText, 'text-secondary-400 px-4 py-2 text-left')}>
						{t('Faction')}
					</th>
					<th class={cn(tableHeadText, 'text-secondary-400 px-4 py-2 text-right')}>
						{t('Picks')}
					</th>
					<th class={cn(tableHeadText, 'text-secondary-400 px-4 py-2 text-right')}>
						{t('Wins')}
					</th>
					<th class={cn(tableHeadText, 'text-secondary-400 px-4 py-2 text-right')}>
						{t('Win rate')}
					</th>
				</tr>
			</thead>
			<tbody>
				{#each [...stats.factions].sort((a, b) => b.picks - a.picks) as faction (faction.raceId)}
					<tr class="border-secondary-800 border-b text-white">
						<td class="px-4 py-2.5">
							<span class="flex items-center gap-3">
								<img
									src={host.resolve.factionFlagByRace(faction.raceId)}
									alt=""
									class="h-5 w-auto shrink-0"
								/>
								{t(getRaceLabel(faction.raceId))}
							</span>
						</td>
						<td class="px-4 py-2.5 text-right tabular-nums">{faction.picks}</td>
						<td class="px-4 py-2.5 text-right tabular-nums">{faction.wins}</td>
						<td class="px-4 py-2.5 text-right tabular-nums">
							{percent(faction.wins, faction.picks)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	{#if stats.maps.length}
		{@render header(t('Maps'))}
		<!-- Cells draw their own right and bottom line; the wrapper clips the outer ones and the last
		     row lands on the closing line, which also closes a short last row. -->
		<div class="border-secondary-800 border-b">
			<div class="-mb-px overflow-hidden">
				<ul class="-mr-px grid sm:grid-cols-2 xl:grid-cols-3">
					{#each stats.maps as map (map.map)}
						<li
							class="border-secondary-800 flex min-w-0 items-center gap-3 border-r border-b px-4 py-3"
						>
							<MapImage map={map.map} class="size-10 shrink-0 rounded" />
							<span class="min-w-0 flex-1 truncate text-white"
								>{normalizeMapName(map.map, false)}</span
							>
							<span class="text-secondary-400 shrink-0 text-sm tabular-nums">
								{map.games === 1 ? t('1 game') : t('{count} games', { count: map.games })}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{/if}

	{#if notableGames.length}
		{@render header(t('Notable games'))}
		<div class="border-secondary-800 border-b">
			<div class="-mb-px overflow-hidden">
				<ul class="-mr-px grid sm:grid-cols-2 xl:grid-cols-3">
					{#each notableGames as item (item.key)}
						<li
							class="border-secondary-800 flex min-w-0 flex-col gap-2 border-r border-b px-4 py-3"
						>
							<span class={cn(tableHeadText, 'text-primary')}>{item.label}</span>
							<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white">
								{@render name(item.game.winner, 'font-semibold')}
								<span class="text-secondary-500">{t('beat')}</span>
								{@render name(item.game.loser)}
							</div>
							<div
								class="text-secondary-400 flex flex-wrap items-center gap-x-3 text-xs tabular-nums"
							>
								{#if item.sub}
									<span>{item.sub}</span>
								{/if}
								{#if item.game.map}
									<span>{normalizeMapName(item.game.map, false)}</span>
								{/if}
								{#if item.game.durationSeconds}
									<span>{formatDurationSeconds(item.game.durationSeconds)}</span>
								{/if}
							</div>
							<Button
								href={host.routes.match(item.game.lobbyId)}
								variant="secondary"
								size="sm"
								class="self-start"
							>
								<FilmReelIcon size={14} weight="duotone" />
								{t('Watch replay')}
							</Button>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{/if}

	{#if stats.mostGames.length}
		{@render header(t('Most games played'))}
		<ol>
			{#each stats.mostGames as entry, index (entry.participant)}
				<li
					class="border-secondary-800 flex items-center gap-3 border-b px-4 py-2.5 text-sm text-white"
				>
					<span class="text-secondary-500 w-5 shrink-0 text-right tabular-nums">{index + 1}</span>
					{@render name(entry.participant, 'flex-1')}
					<span class="text-secondary-400 shrink-0 tabular-nums">
						{entry.games === 1 ? t('1 game') : t('{count} games', { count: entry.games })}
					</span>
				</li>
			{/each}
		</ol>
	{/if}

	{#if stats.championPath.length && tournament.winner}
		{@const champion = tournament.winner}
		{@render header(t("Champion's path"))}
		<ol>
			{#each stats.championPath as id (id)}
				{@const match = matchById.get(id)}
				{#if match}
					{@const asA = match.playerA === champion}
					<li
						class="border-secondary-800 flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2.5 text-sm text-white"
					>
						<span class="text-secondary-400 w-40 shrink-0">
							{roundLabel(t, tournament.format, match, rounds(match.bracket))}
						</span>
						<span class="text-secondary-500">{t('vs')}</span>
						{@render name(asA ? match.playerB : match.playerA, 'min-w-0 flex-1')}
						<span class="font-heading shrink-0 font-bold tabular-nums">
							{#if match.games.length === 0 && match.winsA + match.winsB === 0}
								{t('Walkover')}
							{:else}
								{asA ? match.winsA : match.winsB} – {asA ? match.winsB : match.winsA}
							{/if}
						</span>
					</li>
				{/if}
			{/each}
		</ol>
	{/if}
{:catch}
	<p class="border-secondary-800 text-secondary-400 border-b px-4 py-6 text-sm">
		{t('Could not load the stats.')}
	</p>
{/await}
