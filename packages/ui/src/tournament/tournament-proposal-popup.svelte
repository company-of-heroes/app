<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import CalendarBlankIcon from 'phosphor-svelte/lib/CalendarBlankIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { modal } from '../ui/modal';
	import { roundLabel } from './format';
	import TournamentScheduleForm from './tournament-schedule-form.svelte';
	import type { MyTournamentMatch, TournamentScheduleProposal } from './types';

	type Props = { item: MyTournamentMatch; proposal: TournamentScheduleProposal };

	let { item, proposal }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	let busy = $state(false);
	let proposing = $state(false);
	const now = Date.now();
	const name = $derived(item.opponent?.alias ?? t('your opponent'));

	async function run(action: () => Promise<unknown>, success: string) {
		if (busy) {
			return;
		}

		busy = true;
		try {
			await action();
			host.notify.success(success);
			modal.close();
		} catch (error) {
			host.notify.error(error instanceof Error ? t(error.message) : t('Something went wrong.'));
		} finally {
			busy = false;
		}
	}

	function accept(time: string) {
		void run(
			() => host.api.tournaments.acceptTime(item.tournament.id, item.match.id, proposal.id, time),
			t('Match time set.')
		);
	}

	function propose(times: string[]) {
		void run(
			() => host.api.tournaments.proposeTimes(item.tournament.id, item.match.id, times),
			t('Times sent to {name}.', { name })
		);
	}

	function decline() {
		void run(
			() => host.api.tournaments.declineTimes(item.tournament.id, item.match.id, proposal.id),
			t('Times declined.')
		);
	}
</script>

<div class="flex flex-col">
	<div class="flex gap-4 px-5 pt-6 pb-5">
		<span
			class="bg-primary/15 text-primary flex size-12 shrink-0 items-center justify-center rounded-full"
		>
			<CalendarBlankIcon size={26} weight="duotone" />
		</span>
		<div class="flex min-w-0 flex-col gap-1">
			<p class="text-secondary-400 text-sm">
				{item.tournament.name}
				<span class="text-secondary-600 px-1">/</span>
				{roundLabel(t, item.tournament.format, item.match, item.rounds || item.match.round)}
			</p>
			<h2 class="font-heading text-2xl leading-tight font-bold text-white">
				{t('{name} proposed a time for your match', { name })}
			</h2>
			<p class="text-secondary-300 text-sm">
				{proposing
					? t('Propose other times. {name} gets a message and picks one of them.', { name })
					: t('Pick the time that suits you, or propose other times.')}
			</p>
		</div>
	</div>
	{#if proposing}
		<TournamentScheduleForm
			{item}
			{busy}
			inset="px-5"
			onSend={propose}
			onCancel={() => (proposing = false)}
		/>
	{:else}
		<ul class="border-secondary-800 border-t">
			{#each proposal.times as time, index (time)}
				<li class="border-secondary-800 flex items-center gap-3 border-b px-5 py-2 text-sm">
					<span class="text-secondary-500 w-16 shrink-0 text-xs">
						{t('Time {number}', { number: index + 1 })}
					</span>
					<ClockIcon class="text-secondary-500 size-4 shrink-0" />
					<span class="text-white tabular-nums">
						{formatDate(time, host.locale(), 'dateTime')}
					</span>
					<Button
						size="sm"
						class="ml-auto"
						disabled={busy || Date.parse(time) <= now}
						onclick={() => accept(time)}
					>
						<CheckIcon class="size-4" />
						{t('Accept')}
					</Button>
				</li>
			{/each}
		</ul>
		<div class="flex flex-wrap justify-end gap-2 px-5 py-4">
			<Button variant="ghost" disabled={busy} onclick={decline}>{t('Decline')}</Button>
			<Button variant="ghost" onclick={() => modal.close()}>{t('Later')}</Button>
			<Button variant="secondary" disabled={busy} onclick={() => (proposing = true)}>
				{t('Propose other times')}
			</Button>
		</div>
	{/if}
</div>
