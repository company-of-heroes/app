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
	import { roundKey } from '@company-of-heroes/api/tournaments';
	import { Button } from '../ui/button';
	import { DatePicker } from '../ui/date-picker';
	import { fromLocalInput, roundLabel, toLocalInput } from './format';
	import type { Tournament, TournamentMatch } from './types';
	import { useTournament } from './context';

	type Props = {
		open: boolean;
		onSave: (rounds: Record<string, string | null>) => Promise<void>;
		onClose: () => void;
	};

	let { open, onSave, onClose }: Props = $props();
	const context = useTournament();
	const tournament = $derived(context.tournament);
	const matches = $derived(context.matches);
	const { t } = useI18n();

	const BRACKET_ORDER = { winners: 0, losers: 1, grand_final: 2, round_robin: 3 } as const;

	/** Every round of the bracket once, in playing order. */
	const rounds = $derived.by(() => {
		const seen = new Map<string, TournamentMatch>();
		for (const match of matches) {
			if (!seen.has(roundKey(match))) {
				seen.set(roundKey(match), match);
			}
		}

		const most = (bracket: TournamentMatch['bracket']) =>
			Math.max(...matches.filter((m) => m.bracket === bracket).map((m) => m.round));
		return [...seen.values()]
			.sort((a, b) => BRACKET_ORDER[a.bracket] - BRACKET_ORDER[b.bracket] || a.round - b.round)
			.map((match) => ({
				key: roundKey(match),
				label: roundLabel(t, tournament.format, match, most(match.bracket))
			}));
	});

	let values = $state<Record<string, string>>({});
	let saving = $state(false);

	watch(
		() => open,
		(isOpen) => {
			if (isOpen) {
				values = Object.fromEntries(
					rounds.map(({ key }) => [key, toLocalInput(tournament.roundDeadlines[key] ?? null)])
				);
			}
		}
	);

	async function save() {
		if (saving) {
			return;
		}

		saving = true;
		try {
			await onSave(
				Object.fromEntries(rounds.map(({ key }) => [key, fromLocalInput(values[key] ?? '')]))
			);
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
				'absolute top-0 left-1/2 z-50 mx-auto mt-12 flex max-h-[calc(100vh-6rem)] w-[520px] max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col overflow-hidden outline-hidden',
				surfaceModal
			)}
		>
			<Dialog.Title class={flushHeader}>
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<p class={flushHeaderTitle}>{t('Deadlines')}</p>
						<Dialog.Description class={flushHeaderDescription}>
							{t(
								'The last moment to play each round, in your local time. Players get a warning 3 days, 1 day and 3 hours before; staff get a notice when a match passes it.'
							)}
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
				class="flex min-h-0 flex-col"
				onsubmit={(event) => {
					event.preventDefault();
					void save();
				}}
			>
				<ul class="min-h-0 overflow-y-auto">
					{#each rounds as round (round.key)}
						<li
							class="border-secondary-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3"
						>
							<span class="text-sm font-semibold text-white">{round.label}</span>
							<div class="w-60 max-w-full">
								<DatePicker
									time
									bind:value={values[round.key]}
									disabled={saving}
									aria-label={round.label}
									calendarLabel={t('Open calendar')}
								/>
							</div>
						</li>
					{/each}
				</ul>
				<div class="flex justify-end gap-2 p-4">
					<Button type="button" variant="ghost" disabled={saving} onclick={onClose}>
						{t('Cancel')}
					</Button>
					<Button type="submit" disabled={saving} loading={saving}>
						{t('Save deadlines')}
					</Button>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
