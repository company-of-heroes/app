<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { TOURNAMENT_SCHEDULE_MAX_TIMES } from '@company-of-heroes/api/tournaments';
	import PaperPlaneRightIcon from 'phosphor-svelte/lib/PaperPlaneRightIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { Button } from '../ui/button';
	import { DatePicker } from '../ui/date-picker';
	import { fromLocalInput, parseTournamentDate, toLocalInput } from './format';
	import type { MyTournamentMatch } from './types';

	type Props = {
		item: MyTournamentMatch;
		busy: boolean;
		/** The checked times as ISO strings. */
		onSend: (times: string[]) => void;
		onCancel: () => void;
		/** Horizontal padding of the rows, to line up with the surrounding panel. */
		inset?: string;
	};

	let { item, busy, onSend, onCancel, inset = 'px-4' }: Props = $props();
	const { t } = useI18n();

	/** Proposed times must lie at least this far ahead (the server checks it too). */
	const LEAD_MS = 5 * 60 * 1000;

	let now = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(timer);
	});

	let nextId = 1;
	let drafts = $state<{ id: number; value: string }[]>([{ id: 0, value: '' }]);

	const name = $derived(item.opponent?.alias ?? t('your opponent'));
	const min = $derived(toLocalInput(new Date(now + LEAD_MS).toISOString()));
	const max = $derived(toLocalInput(item.match.deadline));
	const earliest = $derived(now + LEAD_MS);
	const latest = $derived(
		item.match.deadline ? Date.parse(parseTournamentDate(item.match.deadline)!) : Infinity
	);
	const valid = $derived(
		drafts.length > 0 &&
			drafts.every((draft) => {
				const value = fromLocalInput(draft.value);
				const at = value ? Date.parse(value) : NaN;
				return at >= earliest && at <= latest;
			})
	);

	function addDraft() {
		if (drafts.length < TOURNAMENT_SCHEDULE_MAX_TIMES) {
			drafts = [...drafts, { id: nextId++, value: '' }];
		}
	}

	function removeDraft(id: number) {
		drafts = drafts.filter((draft) => draft.id !== id);
	}

	function send(event: SubmitEvent) {
		event.preventDefault();
		onSend(
			drafts
				.map((draft) => fromLocalInput(draft.value))
				.filter((time): time is string => Boolean(time))
		);
	}
</script>

<form class="flex flex-col" onsubmit={send}>
	<p class="border-secondary-800 text-secondary-400 border-t {inset} py-2 text-xs">
		{t('Propose up to {count} times in your local time. {name} picks one of them.', {
			count: TOURNAMENT_SCHEDULE_MAX_TIMES,
			name
		})}
	</p>
	{#each drafts as draft, index (draft.id)}
		<div class="border-secondary-800 flex items-center gap-3 border-t {inset} py-2">
			<span class="text-secondary-500 w-16 shrink-0 text-xs">
				{t('Time {number}', { number: index + 1 })}
			</span>
			<div class="w-full max-w-xs min-w-0">
				<DatePicker
					time
					bind:value={draft.value}
					{min}
					max={max || undefined}
					disabled={busy}
					aria-label={t('Time {number}', { number: index + 1 })}
					calendarLabel={t('Open calendar')}
				/>
			</div>
			{#if drafts.length > 1}
				<Button
					type="button"
					size="icon-sm"
					variant="ghost"
					disabled={busy}
					aria-label={t('Remove time')}
					onclick={() => removeDraft(draft.id)}
				>
					<XIcon class="size-4" />
				</Button>
			{/if}
		</div>
	{/each}
	<div class="border-secondary-800 flex flex-wrap items-center gap-2 border-t {inset} py-2">
		{#if drafts.length < TOURNAMENT_SCHEDULE_MAX_TIMES}
			<Button type="button" size="sm" variant="ghost" disabled={busy} onclick={addDraft}>
				<PlusIcon class="size-4" />
				{t('Add time')}
			</Button>
		{/if}
		<Button
			type="button"
			size="sm"
			variant="ghost"
			class="ml-auto"
			disabled={busy}
			onclick={onCancel}
		>
			{t('Cancel')}
		</Button>
		<Button type="submit" size="sm" disabled={busy || !valid} loading={busy}>
			<PaperPlaneRightIcon class="size-4" />
			{t('Send')}
		</Button>
	</div>
</form>
