<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import CalendarBlankIcon from 'phosphor-svelte/lib/CalendarBlankIcon';
	import CrownIcon from 'phosphor-svelte/lib/CrownIcon';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import UsersIcon from 'phosphor-svelte/lib/UsersIcon';
	import { tooltip } from '../attachments';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import { FORMAT_LABELS, parseTournamentDate } from './format';
	import TournamentStatus from './tournament-status.svelte';
	import type { Tournament } from './types';

	type Props = {
		tournaments: Tournament[];
		emptyMessage: string;
		/** Dimmed banners in more columns (past tournaments). */
		compact?: boolean;
	};

	let { tournaments, emptyMessage, compact = false }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
</script>

{#if tournaments.length === 0}
	<div
		class="border-secondary-800 text-secondary-500 flex items-center gap-3 border-b px-4 py-6 text-sm"
	>
		<TrophyIcon size={20} weight="duotone" class="shrink-0" />
		<p>{emptyMessage}</p>
	</div>
{:else}
	<!-- Cards in columns: every cell draws its right and bottom line. The wrapper clips the right
	edge and the last row's line, then closes the grid with its own line so a short last row
	still ends in exactly one line. -->
	<div class="border-secondary-800 shrink-0 overflow-hidden border-b">
		<ul
			class={cn(
				'-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2',
				compact ? 'lg:grid-cols-3 xl:grid-cols-4' : 'xl:grid-cols-3'
			)}
		>
			{#each tournaments as tournament (tournament.id)}
				<li class="border-secondary-800 min-w-0 border-r border-b">
					<!-- A small version of the tournament page header: banner, logo and name, then the facts. -->
					<a
						href={host.routes.tournament(tournament.slug)}
						class={cn(interactive, 'group flex h-full min-w-0 flex-col bg-gray-950')}
					>
						<div
							class="relative isolate flex min-h-40 flex-1 items-end overflow-hidden px-4 pt-12 pb-4"
						>
							{#if tournament.bannerUrl}
								<img
									src={tournament.bannerUrl}
									alt=""
									aria-hidden="true"
									loading="lazy"
									class={cn(
										'absolute inset-0 -z-10 size-full object-cover transition-transform duration-500 group-hover:scale-105',
										compact && 'opacity-60 grayscale'
									)}
								/>
								<div
									class="pointer-events-none absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/75 to-gray-950/10"
								></div>
							{:else}
								<div
									class="from-primary/10 pointer-events-none absolute inset-0 -z-10 bg-radial-[at_15%_0%] via-transparent to-transparent"
								></div>
							{/if}
							<div class="flex min-w-0 items-end gap-4">
								{#if tournament.logoUrl}
									<img
										src={tournament.logoUrl}
										alt=""
										class="border-secondary-700 size-16 shrink-0 rounded-md border bg-gray-950 object-cover shadow-lg shadow-black/50"
									/>
								{:else}
									<div
										class="border-primary/20 bg-primary/5 text-primary flex size-16 shrink-0 items-center justify-center rounded-md border"
									>
										<TrophyIcon weight="duotone" class="size-8" />
									</div>
								{/if}
								<div class="flex min-w-0 flex-col gap-1.5">
									<div class="flex min-w-0 items-center gap-2">
										<TournamentStatus status={tournament.status} class="shrink-0" />
										{#if tournament.status === 'in_progress' && tournament.liveCount > 0}
											<Badge variant="destructive" pulse class="shrink-0">
												{t('{count} live', { count: tournament.liveCount })}
											</Badge>
										{/if}
										<span class="text-secondary-300 truncate text-xs">
											{t(FORMAT_LABELS[tournament.format])} · {t('Best of {count}', {
												count: tournament.bestOf
											})}
										</span>
									</div>
									<p
										class="font-heading group-hover:text-primary line-clamp-2 text-xl leading-tight font-bold break-words text-white drop-shadow-md transition-colors"
									>
										{tournament.name}
									</p>
								</div>
							</div>
						</div>
						<div
							class="border-secondary-800 text-secondary-400 flex items-center gap-4 border-t px-4 py-2 text-sm tabular-nums"
						>
							<span class="inline-flex shrink-0 items-center gap-2" {@attach tooltip(t('Players'))}>
								<UsersIcon size={14} weight="duotone" />
								{#if tournament.maxParticipants}
									{tournament.participantCount} / {tournament.maxParticipants}
									<span class="bg-secondary-800 h-1 w-12 overflow-hidden rounded-full">
										<span
											class="bg-primary block h-full rounded-full"
											style:width="{Math.min(
												100,
												(tournament.participantCount / tournament.maxParticipants) * 100
											)}%"
										></span>
									</span>
								{:else}
									{tournament.participantCount}
								{/if}
							</span>
							{#if tournament.champion}
								<span
									class="text-primary ms-auto inline-flex min-w-0 items-center gap-1 font-medium"
									{@attach tooltip(t('Champion'))}
								>
									<CrownIcon size={14} weight="fill" class="shrink-0" />
									<span class="truncate">{tournament.champion}</span>
								</span>
							{:else if tournament.startsAt}
								<span class="ms-auto inline-flex min-w-0 items-center gap-1">
									<CalendarBlankIcon size={14} weight="duotone" class="shrink-0" />
									<span class="truncate">
										{formatDate(parseTournamentDate(tournament.startsAt), host.locale(), 'date')}
									</span>
								</span>
							{/if}
						</div>
					</a>
				</li>
			{/each}
		</ul>
	</div>
{/if}
