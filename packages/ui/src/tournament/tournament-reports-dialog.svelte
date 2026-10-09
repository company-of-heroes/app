<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { Dialog } from 'bits-ui';
	import { watch } from 'runed';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderDescription,
		flushHeaderTitle,
		overlayBackdrop,
		surfaceModal
	} from '@company-of-heroes/ui/variants';
	import CloseIcon from 'phosphor-svelte/lib/XIcon';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import { Textarea } from '../ui/input';
	import { ToggleGroup } from '../ui/toggle-group';
	import { parseTournamentDate, roundLabel } from './format';
	import {
		REPORT_REASON_LABELS,
		REPORT_STATUS_LABELS,
		REPORT_STATUS_VARIANTS
	} from './tournament-report-dialog.svelte';
	import type {
		Tournament,
		TournamentParticipant,
		TournamentReportRecord,
		TournamentReportStatus
	} from './types';
	import { useTournament } from './context';

	type Props = {
		open: boolean;
		onClose: () => void;
		/** A report was handled: the page reloads its open count. */
		onChange?: () => void;
	};

	let { open, onClose, onChange }: Props = $props();
	const context = useTournament();
	const tournament = $derived(context.tournament);
	const participants = $derived(context.participantsById);
	const { t } = useI18n();
	const host = useHost();

	let reports = $state.raw<TournamentReportRecord[]>([]);
	let loading = $state(false);
	let filter = $state<string>('open');
	let notes = $state<Record<string, string>>({});
	let saving = $state<string | null>(null);

	const counts = $derived({
		open: reports.filter((report) => report.status === 'open').length,
		resolved: reports.filter((report) => report.status === 'resolved').length,
		dismissed: reports.filter((report) => report.status === 'dismissed').length
	});
	const filters = $derived([
		{ value: 'open', label: t('Open ({count})', { count: counts.open }) },
		{ value: 'resolved', label: t('Resolved ({count})', { count: counts.resolved }) },
		{ value: 'dismissed', label: t('Dismissed ({count})', { count: counts.dismissed }) },
		{ value: 'all', label: t('All ({count})', { count: reports.length }) }
	]);
	const shown = $derived(
		filter === 'all' ? reports : reports.filter((report) => report.status === filter)
	);

	const alias = (id: string | null) => (id ? participants.get(id)?.alias : null) ?? t('TBD');
	const date = (value: string) => formatDate(parseTournamentDate(value), host.locale(), 'dateTime');

	async function load() {
		loading = true;
		try {
			reports = await host.api.tournaments.reports(tournament.id);
			notes = Object.fromEntries(reports.map((report) => [report.id, report.staffNote]));
		} catch (error) {
			host.notify.error(error instanceof Error ? t(error.message) : t('Something went wrong.'));
		} finally {
			loading = false;
		}
	}

	watch(
		() => open,
		(isOpen) => {
			if (isOpen) {
				filter = 'open';
				void load();
			}
		}
	);

	async function save(report: TournamentReportRecord, status: TournamentReportStatus) {
		if (saving) {
			return;
		}

		saving = report.id;
		try {
			const saved = await host.api.tournaments.updateReport(tournament.id, report.id, {
				status,
				staffNote: notes[report.id] ?? ''
			});
			reports = reports.map((item) => (item.id === saved.id ? saved : item));
			notes = { ...notes, [saved.id]: saved.staffNote };
			host.notify.success(
				status === 'resolved'
					? t('Report resolved. The player got your note.')
					: status === 'dismissed'
						? t('Report dismissed. The player got your note.')
						: t('Report reopened.')
			);
			onChange?.();
		} catch (error) {
			host.notify.error(error instanceof Error ? t(error.message) : t('Something went wrong.'));
		} finally {
			saving = null;
		}
	}
</script>

<Dialog.Root
	{open}
	onOpenChange={(next) => {
		if (!next) {
			onClose();
		}
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class={cn(overlayBackdrop, 'fixed inset-0 z-50')} />
		<Dialog.Content
			class={cn(
				'absolute top-0 left-1/2 z-50 mx-auto my-12 flex max-h-[calc(100dvh-6rem)] w-[720px] max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col overflow-hidden outline-hidden',
				surfaceModal
			)}
		>
			<div class={flushHeader}>
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<Dialog.Title class={flushHeaderTitle}>{t('Problem reports')}</Dialog.Title>
						<Dialog.Description class={flushHeaderDescription}>
							{t('Players report problems with their match here. Your note goes to the player.')}
						</Dialog.Description>
					</div>
					<Dialog.Close
						class="bg-secondary-800 hover:bg-secondary-700 cursor-pointer rounded-md p-1 transition outline-none"
						aria-label={t('Close')}
					>
						<CloseIcon size={20} />
					</Dialog.Close>
				</div>
			</div>
			<div class="border-secondary-800 border-b px-4 py-2.5">
				<ToggleGroup bind:value={filter} items={filters} size="sm" aria-label={t('Status')} />
			</div>
			<div class="min-h-0 flex-1 overflow-y-auto">
				{#if loading && reports.length === 0}
					<p class="text-secondary-400 px-4 py-4 text-sm">{t('Loading...')}</p>
				{:else if shown.length === 0}
					<p class="text-secondary-400 px-4 py-4 text-sm">{t('No reports here.')}</p>
				{:else}
					<ul class="[&>li:last-child]:border-b-0">
						{#each shown as report (report.id)}
							{@const busy = saving === report.id}
							{@const changed = (notes[report.id] ?? '') !== report.staffNote}
							<li class="border-secondary-800 flex flex-col gap-3 border-b px-4 py-4">
								<div class="flex flex-wrap items-start justify-between gap-2">
									<div class="flex min-w-0 flex-col gap-0.5">
										<p class="text-primary text-sm font-medium">
											{roundLabel(t, tournament.format, report.match, report.rounds)}
										</p>
										<p class="truncate font-semibold text-white">
											{t('{a} vs {b}', { a: alias(report.playerA), b: alias(report.playerB) })}
										</p>
									</div>
									<Badge variant={REPORT_STATUS_VARIANTS[report.status]} class="shrink-0">
										{t(REPORT_STATUS_LABELS[report.status])}
									</Badge>
								</div>
								<div class="flex flex-col gap-1 text-sm">
									<p class="text-secondary-200 font-medium">
										{t(REPORT_REASON_LABELS[report.reason])}
									</p>
									{#if report.message}
										<p class="text-secondary-300 break-words whitespace-pre-line">
											{report.message}
										</p>
									{/if}
									<p class="text-secondary-500 text-xs">
										{t('By {name} on {date}', {
											name: report.reporter.name,
											date: date(report.created)
										})}
										{#if report.handledBy && report.handledAt}
											· {t('Handled by {name} on {date}', {
												name: report.handledBy.name,
												date: date(report.handledAt)
											})}
										{/if}
									</p>
								</div>
								<Textarea
									bind:value={notes[report.id]}
									rows={2}
									maxlength={2000}
									placeholder={t('Note for the player (optional)')}
									aria-label={t('Note for the player')}
									disabled={busy}
								/>
								<div class="flex flex-wrap justify-end gap-2">
									{#if report.status === 'open'}
										<Button
											size="sm"
											variant="ghost"
											disabled={!!saving}
											onclick={() => save(report, 'dismissed')}
										>
											{t('Dismiss')}
										</Button>
										<Button
											size="sm"
											disabled={!!saving}
											loading={busy}
											onclick={() => save(report, 'resolved')}
										>
											{t('Resolve')}
										</Button>
									{:else}
										{#if changed}
											<Button
												size="sm"
												variant="secondary"
												disabled={!!saving}
												loading={busy}
												onclick={() => save(report, report.status)}
											>
												{t('Save note')}
											</Button>
										{/if}
										<Button
											size="sm"
											variant="ghost"
											disabled={!!saving}
											onclick={() => save(report, 'open')}
										>
											{t('Reopen')}
										</Button>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
