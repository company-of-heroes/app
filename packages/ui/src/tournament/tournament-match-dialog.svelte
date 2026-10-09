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
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
	import { winsNeeded } from '@company-of-heroes/api/tournaments';
	import { Button } from '../ui/button';
	import { DatePicker } from '../ui/date-picker';
	import { Input } from '../ui/input';
	import { Label } from '../ui/label';
	import { fromLocalInput, toLocalInput } from './format';
	import type { TournamentMatch, TournamentMatchResult, TournamentParticipant } from './types';
	import { useTournament } from './context';

	type Props = {
		match: TournamentMatch | null;
		onSave: (match: TournamentMatch, result: TournamentMatchResult) => Promise<void>;
		/** This match's own deadline (null: the round's again). */
		onDeadline: (match: TournamentMatch, deadline: string | null) => Promise<void>;
		/** Staff: set or clear the agreed match time (null clears it). */
		onTime?: (match: TournamentMatch, scheduledAt: string | null) => Promise<void>;
		/** Staff: put this match in the spotlight on the tournament page (false clears it). */
		onFeature?: (match: TournamentMatch, featured: boolean) => Promise<void>;
		/** This match is the tournament's featured match. */
		featured?: boolean;
		onClose: () => void;
	};

	let { match, onSave, onDeadline, onTime, onFeature, featured = false, onClose }: Props = $props();
	const context = useTournament();
	const participants = $derived(context.participantsById);
	const { t } = useI18n();

	let winsA = $state(0);
	let winsB = $state(0);
	let deadline = $state('');
	let scheduledAt = $state('');
	let saving = $state(false);

	const open = $derived(match !== null);
	const needed = $derived(match ? winsNeeded(match.bestOf) : 1);
	const aliasA = $derived(match?.playerA ? (participants.get(match.playerA)?.alias ?? '') : '');
	const aliasB = $derived(match?.playerB ? (participants.get(match.playerB)?.alias ?? '') : '');
	const valid = $derived(
		winsA >= 0 &&
			winsB >= 0 &&
			winsA <= needed &&
			winsB <= needed &&
			!(winsA === needed && winsB === needed)
	);

	watch(
		() => match,
		(current) => {
			if (current) {
				winsA = current.winsA;
				winsB = current.winsB;
				deadline = toLocalInput(current.deadlineOverride);
				scheduledAt = toLocalInput(current.scheduledAt);
			}
		}
	);

	async function saveDeadline(value: string | null) {
		if (!match || saving) {
			return;
		}

		saving = true;
		try {
			await onDeadline(match, value);
		} finally {
			saving = false;
		}
	}

	async function saveTime(value: string | null) {
		if (!match || !onTime || saving) {
			return;
		}

		saving = true;
		try {
			await onTime(match, value);
		} finally {
			saving = false;
		}
	}

	async function feature(next: boolean) {
		if (!match || !onFeature || saving) {
			return;
		}

		saving = true;
		try {
			await onFeature(match, next);
		} finally {
			saving = false;
		}
	}

	async function save(result: TournamentMatchResult) {
		if (!match || saving) {
			return;
		}

		saving = true;
		try {
			await onSave(match, result);
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root
	{open}
	onOpenChange={(next) => {
		if (!next && !saving) {
			onClose();
		}
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class={cn(overlayBackdrop, 'fixed inset-0 z-50')} />
		<Dialog.Content
			class={cn(
				'absolute top-0 left-1/2 z-50 mx-auto mt-12 w-[480px] max-w-[calc(100%-2rem)] -translate-x-1/2 overflow-hidden outline-hidden',
				surfaceModal
			)}
		>
			<Dialog.Title class={flushHeader}>
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<p class={flushHeaderTitle}>{t('Match result')}</p>
						<Dialog.Description class={flushHeaderDescription}>
							{t('Best of {count}: the first to {wins} wins takes the match.', {
								count: match?.bestOf ?? 1,
								wins: needed
							})}
						</Dialog.Description>
					</div>
					<Dialog.Close
						class="bg-secondary-800 hover:bg-secondary-700 cursor-pointer rounded-md p-1 transition outline-none"
						aria-label={t('Close')}
					>
						<CloseIcon size={20} />
					</Dialog.Close>
				</div>
			</Dialog.Title>
			<form
				class="flex flex-col gap-4 p-4"
				onsubmit={(event) => {
					event.preventDefault();
					void save({ winsA, winsB });
				}}
			>
				<div class="grid grid-cols-2 gap-3">
					<div class="flex min-w-0 flex-col gap-2">
						<Label for="tournament-wins-a" class="truncate">{aliasA}</Label>
						<Input id="tournament-wins-a" type="number" min={0} max={needed} bind:value={winsA} />
						<Button
							type="button"
							variant="secondary"
							size="sm"
							disabled={saving}
							onclick={() => void save({ walkover: 'A' })}
						>
							{t('Walkover win')}
						</Button>
					</div>
					<div class="flex min-w-0 flex-col gap-2">
						<Label for="tournament-wins-b" class="truncate">{aliasB}</Label>
						<Input id="tournament-wins-b" type="number" min={0} max={needed} bind:value={winsB} />
						<Button
							type="button"
							variant="secondary"
							size="sm"
							disabled={saving}
							onclick={() => void save({ walkover: 'B' })}
						>
							{t('Walkover win')}
						</Button>
					</div>
				</div>
				<p class="text-secondary-400 text-xs">
					{t(
						'A result set here stops automatic tracking for this match. Reset it to count started tournament games again.'
					)}
				</p>
				<div class="flex flex-wrap justify-end gap-2">
					<Button
						type="button"
						variant="ghost"
						disabled={saving}
						onclick={() => void save({ reset: true })}
					>
						{t('Reset match')}
					</Button>
					<Button type="submit" disabled={!valid || saving} loading={saving}>
						{t('Save result')}
					</Button>
				</div>
			</form>
			{#if match?.status !== 'completed'}
				<div class="border-secondary-800 flex flex-col gap-2 border-t p-4">
					<span class="text-secondary-300 text-sm font-medium">{t('Deadline for this match')}</span>
					<div class="flex flex-wrap items-center gap-2">
						<div class="min-w-0 flex-1">
							<DatePicker
								time
								bind:value={deadline}
								disabled={saving}
								aria-label={t('Deadline for this match')}
								calendarLabel={t('Open calendar')}
							/>
						</div>
						<Button
							type="button"
							variant="secondary"
							disabled={saving || !deadline}
							onclick={() => void saveDeadline(fromLocalInput(deadline))}
						>
							{t('Save deadline')}
						</Button>
						{#if match?.deadlineOverride}
							<Button
								type="button"
								variant="ghost"
								disabled={saving}
								onclick={() => void saveDeadline(null)}
							>
								{t('Use round deadline')}
							</Button>
						{/if}
					</div>
					<p class="text-secondary-400 text-xs">
						{t('Without its own deadline the match uses the deadline of its round.')}
					</p>
				</div>
			{/if}
			{#if onTime && match?.status !== 'completed'}
				<div class="border-secondary-800 flex flex-col gap-2 border-t p-4">
					<span class="text-secondary-300 text-sm font-medium">{t('Match time')}</span>
					<div class="flex flex-wrap items-center gap-2">
						<div class="min-w-0 flex-1">
							<DatePicker
								time
								bind:value={scheduledAt}
								disabled={saving}
								aria-label={t('Match time')}
								calendarLabel={t('Open calendar')}
							/>
						</div>
						<Button
							type="button"
							variant="secondary"
							disabled={saving || !scheduledAt}
							onclick={() => void saveTime(fromLocalInput(scheduledAt))}
						>
							{t('Save time')}
						</Button>
						{#if match?.scheduledAt}
							<Button
								type="button"
								variant="ghost"
								disabled={saving}
								onclick={() => void saveTime(null)}
							>
								{t('Clear time')}
							</Button>
						{/if}
					</div>
					<p class="text-secondary-400 text-xs">
						{t('Both players get a notification and a reminder 30 minutes before the match.')}
					</p>
				</div>
			{/if}
			{#if onFeature && match?.status !== 'completed'}
				<div class="border-secondary-800 flex flex-wrap items-center gap-2 border-t p-4">
					<div class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="text-secondary-300 text-sm font-medium">{t('Featured match')}</span>
						<span class="text-secondary-400 text-xs">
							{featured
								? t('This match is shown at the top of the tournament page.')
								: t('Show this match at the top of the tournament page.')}
						</span>
					</div>
					<Button
						type="button"
						variant={featured ? 'ghost' : 'secondary'}
						disabled={saving}
						onclick={() => void feature(!featured)}
					>
						<StarIcon size={16} weight={featured ? 'fill' : 'regular'} />
						{featured ? t('Stop featuring') : t('Feature this match')}
					</Button>
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
