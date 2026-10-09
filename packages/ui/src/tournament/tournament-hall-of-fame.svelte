<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderTitle,
		interactive,
		tableHeadText
	} from '@company-of-heroes/ui/variants';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import CrownIcon from 'phosphor-svelte/lib/CrownIcon';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import { escapeHtml, tooltip } from '../attachments';
	import { countryDisplayName } from '../format/country';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { Skeleton } from '../ui/skeleton';
	import { FORMAT_LABELS, parseTournamentDate } from './format';
	import type { HallOfFame } from './types';

	type Props = {
		/** Loaded by the host already (website SSR); without it the component loads it. */
		initial?: HallOfFame;
	};

	let { initial }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
	const medals = host.resolve.medals();

	const hallOfFame = $derived(initial ?? host.api.tournaments.hallOfFame());

	const PLACES: Record<number, string> = {
		1: 'text-warning',
		2: 'text-secondary-200',
		3: 'text-orange-400'
	};
</script>

{#snippet player(alias: string, country: string, steamId: string, className = '')}
	{@const flagUrl = host.resolve.flagImageUrl(country)}
	{@const countryName = countryDisplayName(country, host.locale())}
	<span class={cn('inline-flex min-w-0 items-center gap-2', className)}>
		{#if flagUrl}
			<img
				class="h-4 w-auto shrink-0 rounded-xs"
				src={flagUrl}
				alt={countryName ?? country}
				{@attach tooltip(escapeHtml(countryName ?? ''))}
			/>
		{/if}
		<a href={host.routes.player(steamId)} class={cn(interactive, 'hover:text-primary truncate')}>
			{alias}
		</a>
	</span>
{/snippet}

<header class="border-secondary-800 relative isolate shrink-0 overflow-hidden border-b">
	<div
		class="from-warning/15 pointer-events-none absolute inset-0 -z-10 bg-radial-[at_15%_0%] via-transparent to-transparent"
	></div>
	<CrownIcon
		weight="duotone"
		class="text-warning/5 pointer-events-none absolute -top-6 right-4 -z-10 hidden size-56 sm:block"
	/>
	<div class="flex flex-col gap-4 px-4 pt-6 pb-6">
		<Button href={host.routes.tournaments()} variant="secondary" size="sm" class="self-start">
			<ArrowLeftIcon size={16} />
			{t('All tournaments')}
		</Button>
		<div class="flex min-w-0 flex-col gap-2">
			<span class={cn(tableHeadText, 'text-warning')}>{t('Tournaments')}</span>
			<h1 class="font-heading text-3xl leading-tight font-bold text-white sm:text-4xl">
				{t('Hall of fame')}
			</h1>
			<p class="text-secondary-400 max-w-2xl text-sm">
				{t('Every tournament champion and the players with the most titles.')}
			</p>
		</div>
	</div>
</header>

{#snippet content(data: HallOfFame)}
	<div class={flushHeader}>
		<p class={flushHeaderTitle}>{t('Champions')}</p>
	</div>
	{#if data.tournaments.length === 0}
		<div
			class="border-secondary-800 text-secondary-500 flex items-center gap-3 border-b px-4 py-6 text-sm"
		>
			<TrophyIcon size={20} weight="duotone" class="shrink-0" />
			<p>{t('No tournament has finished yet.')}</p>
		</div>
	{:else}
		<!-- Cells draw their own right and bottom line; the wrapper clips the outer ones and the last
		     row lands on the closing line, which also closes a short last row. -->
		<div class="border-secondary-800 border-b">
			<div class="-mb-px overflow-hidden">
				<ul class="-mr-px grid sm:grid-cols-2 xl:grid-cols-3">
					{#each data.tournaments as entry (entry.tournament.id)}
						{@const tournament = entry.tournament}
						{@const picked = medals.find((m) => m.key === tournament.medal)}
						<li class="border-secondary-800 flex min-w-0 gap-4 border-r border-b px-4 py-4">
							{#if picked}
								<img
									src={picked.url}
									alt=""
									class="h-20 w-auto shrink-0 drop-shadow-[0_2px_2px_rgb(0_0_0/0.6)]"
								/>
							{:else if tournament.logoUrl}
								<img
									src={tournament.logoUrl}
									alt=""
									class="border-secondary-700 size-16 shrink-0 rounded-md border bg-gray-950 object-cover"
								/>
							{:else}
								<div
									class="border-warning/20 bg-warning/5 text-warning flex size-16 shrink-0 items-center justify-center rounded-md border"
								>
									<TrophyIcon weight="duotone" class="size-8" />
								</div>
							{/if}
							<div class="flex min-w-0 flex-1 flex-col gap-2">
								<div class="flex min-w-0 flex-col gap-0.5">
									<a
										href={host.routes.tournament(tournament.slug)}
										class={cn(
											interactive,
											'font-heading hover:text-primary truncate text-lg leading-tight font-bold text-white'
										)}
									>
										{tournament.name}
									</a>
									<span class="text-secondary-400 flex flex-wrap gap-x-3 text-xs tabular-nums">
										<span
											>{formatDate(
												parseTournamentDate(entry.finishedAt),
												host.locale(),
												'date'
											)}</span
										>
										<span>{t(FORMAT_LABELS[tournament.format])}</span>
										<span>{t('{count} players', { count: tournament.participantCount })}</span>
									</span>
								</div>
								<ol class="flex flex-col gap-1 text-sm">
									{#each entry.podium as place (place.steamId)}
										<li class="flex min-w-0 items-center gap-2">
											{#if place.placement === 1}
												<CrownIcon size={14} weight="fill" class="text-warning shrink-0" />
											{:else}
												<span
													class={cn(
														'w-3.5 shrink-0 text-center text-xs font-bold tabular-nums',
														PLACES[place.placement]
													)}
												>
													{place.placement}
												</span>
											{/if}
											{@render player(
												place.alias,
												place.country,
												place.steamId,
												place.placement === 1 ? 'font-semibold text-white' : 'text-secondary-300'
											)}
										</li>
									{/each}
								</ol>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{/if}

	{#if data.players.length}
		<div class={flushHeader}>
			<p class={flushHeaderTitle}>{t('Most titles')}</p>
		</div>
		<table class="w-full text-sm">
			<thead>
				<tr class="border-secondary-800 border-b">
					<th class={cn(tableHeadText, 'text-secondary-400 w-12 px-4 py-2 text-right')}>#</th>
					<th class={cn(tableHeadText, 'text-secondary-400 px-4 py-2 text-left')}>
						{t('Player')}
					</th>
					<th class={cn(tableHeadText, 'text-secondary-400 px-4 py-2 text-right')}>
						{t('Titles')}
					</th>
					<th class={cn(tableHeadText, 'text-secondary-400 px-4 py-2 text-right')}>
						{t('Podiums')}
					</th>
				</tr>
			</thead>
			<tbody>
				{#each data.players as entry, index (entry.steamId)}
					<tr class="border-secondary-800 border-b text-white">
						<td class="text-secondary-500 px-4 py-2.5 text-right tabular-nums">{index + 1}</td>
						<td class="max-w-0 px-4 py-2.5">
							{@render player(entry.alias, entry.country, entry.steamId, 'max-w-full')}
						</td>
						<td class="px-4 py-2.5 text-right font-semibold tabular-nums">
							<span class="inline-flex items-center gap-1">
								{#if entry.titles > 0}
									<CrownIcon size={12} weight="fill" class="text-warning" />
								{/if}
								{entry.titles}
							</span>
						</td>
						<td class="text-secondary-300 px-4 py-2.5 text-right tabular-nums">
							{entry.podiums}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
{/snippet}

{#if initial}
	{@render content(initial)}
{:else}
	{#await hallOfFame}
		<div class={flushHeader}>
			<Skeleton class="h-3 w-24" />
		</div>
		<div class="overflow-hidden">
			<div class="-mr-px grid sm:grid-cols-2 xl:grid-cols-3">
				{#each [0, 1, 2] as index (index)}
					<div class="border-secondary-800 flex gap-4 border-r border-b px-4 py-4">
						<Skeleton class="size-16 shrink-0" />
						<div class="flex flex-1 flex-col gap-2">
							<Skeleton class="h-5 w-3/4" />
							<Skeleton class="h-3 w-1/2" />
							<Skeleton class="h-4 w-2/3" />
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:then data}
		{@render content(data)}
	{:catch}
		<p class="border-secondary-800 text-secondary-400 border-b px-4 py-6 text-sm">
			{t('Could not load the hall of fame.')}
		</p>
	{/await}
{/if}
