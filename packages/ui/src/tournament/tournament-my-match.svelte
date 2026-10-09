<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import type { Snippet } from 'svelte';
	import DownloadSimpleIcon from 'phosphor-svelte/lib/DownloadSimpleIcon';
	import FilmReelIcon from 'phosphor-svelte/lib/FilmReelIcon';
	import HourglassIcon from 'phosphor-svelte/lib/HourglassMediumIcon';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import WarningIcon from 'phosphor-svelte/lib/WarningIcon';
	import { tooltip } from '../attachments/tooltip.svelte';
	import { interactive } from '../variants';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import type { CommunityMatchDetail } from '../replay/types';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import { deadlineState, roundLabel, timeLeft } from './format';
	import TournamentReportDialog, {
		REPORT_REASON_LABELS,
		REPORT_STATUS_LABELS,
		REPORT_STATUS_VARIANTS
	} from './tournament-report-dialog.svelte';
	import TournamentSchedule from './tournament-schedule.svelte';
	import type { MyTournamentMatch } from './types';

	type Props = {
		items: MyTournamentMatch[];
		/** Host-only action per match (the desktop app's "Start tournament game"). */
		start?: Snippet<[MyTournamentMatch]>;
		/** A time was proposed or agreed on: the host reloads the matches. */
		onChange?: () => void;
		class?: string;
	};

	let { items, start, onChange, class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	// Re-render the countdowns every minute.
	let now = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(timer);
	});

	let reporting = $state<MyTournamentMatch | null>(null);

	// The match page is the replay viewer; this is all the download endpoint needs.
	const replayOf = (lobbyId: string) =>
		({ id: lobbyId, kind: 'match', downloadCount: 0 }) as CommunityMatchDetail;
</script>

{#snippet side(
	alias: string,
	country: string,
	wins: number,
	needed: number,
	leading: boolean,
	align: 'start' | 'end'
)}
	{@const flagUrl = country ? host.resolve.flagImageUrl(country) : null}
	<div
		class={cn('flex w-24 min-w-0 flex-col gap-1.5', align === 'end' ? 'items-end' : 'items-start')}
	>
		<span
			class={cn(
				'flex max-w-full min-w-0 items-center gap-1.5 text-xs',
				align === 'end' && 'flex-row-reverse'
			)}
		>
			{#if flagUrl}
				<img src={flagUrl} alt="" class="h-3 w-auto shrink-0 rounded-xs" />
			{/if}
			<span class="text-secondary-400 truncate">{alias}</span>
		</span>
		<span
			class={cn(
				'font-heading text-4xl leading-none font-bold tabular-nums',
				leading ? 'text-primary' : 'text-white'
			)}
		>
			{wins}
		</span>
		<span class={cn('flex gap-1', align === 'end' && 'flex-row-reverse')}>
			{#each { length: needed }, index (index)}
				<span class={cn('h-1 w-4 rounded-full', index < wins ? 'bg-primary' : 'bg-secondary-800')}
				></span>
			{/each}
		</span>
	</div>
{/snippet}

<ul class={cn('-mb-px', className)}>
	{#each items as item (item.match.id)}
		{@const state = deadlineState(item.match, now)}
		{@const mine = item.mySlot === 'A' ? item.match.winsA : item.match.winsB}
		{@const theirs = item.mySlot === 'A' ? item.match.winsB : item.match.winsA}
		{@const needed = Math.floor(item.match.bestOf / 2) + 1}
		<li class="border-secondary-800 border-b">
			<div class="flex flex-col md:flex-row">
				<div class="flex min-w-0 flex-1 items-end gap-4 px-4 py-4">
					<a
						href={host.routes.tournament(item.tournament.slug)}
						class={cn(
							interactive,
							'border-secondary-700 text-primary flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-gray-950 shadow-lg shadow-black/50'
						)}
						aria-label={item.tournament.name}
					>
						{#if item.tournament.logoUrl}
							<img src={item.tournament.logoUrl} alt="" class="size-full object-cover" />
						{:else}
							<TrophyIcon size={30} weight="duotone" />
						{/if}
					</a>
					<div class="flex min-w-0 flex-1 flex-col gap-1">
						<p class="truncate text-sm">
							<a
								href={host.routes.tournament(item.tournament.slug)}
								class={cn(interactive, 'text-secondary-300 hover:text-primary transition-colors')}
							>
								{item.tournament.name}
							</a>
							<span class="text-secondary-600 px-1">/</span>
							<span class="text-primary font-medium">
								{roundLabel(t, item.tournament.format, item.match, item.rounds || item.match.round)}
							</span>
						</p>
						<p class="font-heading truncate text-2xl leading-tight font-bold text-white">
							{t('vs {name}', { name: item.opponent?.alias ?? t('your opponent') })}
						</p>
						<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
							<span class="text-secondary-400">
								{t('Best of {count}', { count: item.match.bestOf })}
							</span>
							{#if item.match.deadline}
								<span
									class={cn(
										'flex items-center gap-1',
										state === 'overdue'
											? 'text-destructive'
											: state === 'soon'
												? 'text-warning'
												: 'text-secondary-400'
									)}
									{@attach tooltip(formatDate(item.match.deadline, host.locale(), 'dateTime'))}
								>
									<HourglassIcon size={14} />
									{state === 'overdue'
										? t('Deadline passed')
										: t('{time} left', { time: timeLeft(t, item.match.deadline, now) })}
								</span>
							{/if}
							{#if item.claim?.status === 'playing'}
								<Badge variant="primary" pulse>{t('Game in progress')}</Badge>
							{:else if state === 'overdue'}
								<Badge variant="destructive">{t('Overdue')}</Badge>
							{/if}
						</div>
					</div>
				</div>
				<!-- Scoreboard: both players, the score and one pip per win needed. Fixed width so every row lines up. -->
				<div
					class={cn(
						'border-secondary-800 flex shrink-0 items-center gap-5 border-t px-4 py-4 md:border-t-0 md:border-l md:px-6',
						start ? 'md:w-[34rem]' : 'md:w-80'
					)}
				>
					<div class="flex min-w-0 flex-1 items-center justify-center gap-4">
						{@render side(item.me.alias, item.me.country, mine, needed, mine > theirs, 'end')}
						<span class="text-secondary-600 font-heading text-2xl">–</span>
						{@render side(
							item.opponent?.alias ?? '?',
							item.opponent?.country ?? '',
							theirs,
							needed,
							theirs > mine,
							'start'
						)}
					</div>
					{#if start}
						<div class="flex shrink-0 items-center">{@render start(item)}</div>
					{/if}
				</div>
			</div>
			<TournamentSchedule
				{item}
				onChange={() => onChange?.()}
				class="border-secondary-800 border-t"
			>
				{#snippet trailing()}
					<Button size="sm" variant="ghost" onclick={() => (reporting = item)}>
						<WarningIcon class="size-4" />
						{t('Report a problem')}
					</Button>
				{/snippet}
			</TournamentSchedule>
			{#if item.reports.length > 0}
				<ul class="border-secondary-800 divide-secondary-800 divide-y border-t">
					{#each item.reports as report (report.id)}
						<li class="flex flex-col gap-1 px-4 py-2 text-sm">
							<div class="flex flex-wrap items-center gap-2">
								<span class="text-secondary-200 font-medium">
									{t(REPORT_REASON_LABELS[report.reason])}
								</span>
								<Badge variant={REPORT_STATUS_VARIANTS[report.status]}>
									{report.status === 'open'
										? t('Staff is looking at it')
										: t(REPORT_STATUS_LABELS[report.status])}
								</Badge>
								<span class="text-secondary-500 ml-auto text-xs">
									{formatDate(report.created.replace(' ', 'T'), host.locale(), 'dateTime')}
								</span>
							</div>
							{#if report.status !== 'open' && report.staffNote}
								<p class="text-secondary-300 break-words whitespace-pre-line">
									<span class="text-secondary-500">{t('Staff note')}:</span>
									{report.staffNote}
								</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
			{#if item.replays.length > 0}
				<div class="border-secondary-800 flex flex-wrap items-center gap-2 border-t px-4 py-2">
					<span class="text-secondary-400 text-xs">{t('Your games')}</span>
					{#each item.replays as replay (replay.lobbyId)}
						{@const detail = replayOf(replay.lobbyId)}
						{@const number =
							item.match.games.findIndex((game) => game.lobbyId === replay.lobbyId) + 1}
						{@const downloadHref = host.api.replays.downloadHref(detail)}
						<span class="flex items-center gap-1">
							<Button href={host.routes.match(replay.lobbyId)} size="sm" variant="secondary">
								<FilmReelIcon class="text-primary size-4" weight="duotone" />
								{t('Game {number}', { number })}
							</Button>
							<Button
								href={downloadHref ?? undefined}
								download={downloadHref ? '' : undefined}
								onclick={() => void host.api.replays.download(detail).catch(() => {})}
								size="icon-sm"
								variant="secondary"
								{@attach tooltip(t('Download replay'))}
								aria-label={t('Download replay')}
							>
								<DownloadSimpleIcon class="size-4" />
							</Button>
						</span>
					{/each}
				</div>
			{/if}
		</li>
	{/each}
</ul>

<TournamentReportDialog
	item={reporting}
	onClose={() => (reporting = null)}
	onSent={() => onChange?.()}
/>
