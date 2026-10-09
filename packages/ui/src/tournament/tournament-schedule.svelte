<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import CalendarBlankIcon from 'phosphor-svelte/lib/CalendarBlankIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import SteamLogoIcon from 'phosphor-svelte/lib/SteamLogoIcon';
	import UserPlusIcon from 'phosphor-svelte/lib/UserPlusIcon';
	import type { Snippet } from 'svelte';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import { parseTournamentDate, timeLeft } from './format';
	import TournamentScheduleForm from './tournament-schedule-form.svelte';
	import type { MyTournamentMatch } from './types';

	type Props = {
		item: MyTournamentMatch;
		/** A time was proposed, accepted or declined: the host reloads the match. */
		onChange: () => void;
		/** Extra actions at the end of the bar (Report a problem). */
		trailing?: Snippet;
		class?: string;
	};

	let { item, onChange, trailing, class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	/** Proposed times must lie at least this far ahead (the server checks it too). */
	const LEAD_MS = 5 * 60 * 1000;

	// Re-render the countdown every minute.
	let now = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(timer);
	});

	let proposing = $state(false);
	let busy = $state(false);

	const name = $derived(item.opponent?.alias ?? t('your opponent'));
	const proposal = $derived(item.schedule?.status === 'pending' ? item.schedule : null);
	const mine = $derived(proposal?.proposedBy === item.me.id);
	const agreedAt = $derived(parseTournamentDate(item.match.scheduledAt));
	const phase = $derived(proposal ? (mine ? 'waiting' : 'respond') : agreedAt ? 'agreed' : 'none');
	const earliest = $derived(now + LEAD_MS);
	const latest = $derived(
		item.match.deadline ? Date.parse(parseTournamentDate(item.match.deadline)!) : Infinity
	);
	// Deadline passed or too close: no time fits, so there is no form to show.
	const tooLate = $derived(latest < earliest);
	const formOpen = $derived(proposing && !tooLate);

	const when = (value: string) => formatDate(value, host.locale(), 'dateTime');

	/** Steam links open in the browser or Steam client (the app hands them to the OS). */
	function external(event: MouseEvent, url: string) {
		if (host.openExternal) {
			event.preventDefault();
			host.openExternal(url);
		}
	}

	function openForm() {
		proposing = true;
	}

	async function run(action: () => Promise<unknown>, success: string) {
		if (busy) {
			return;
		}

		busy = true;
		try {
			await action();
			host.notify.success(success);
			proposing = false;
			onChange();
		} catch (error) {
			host.notify.error(error instanceof Error ? t(error.message) : t('Something went wrong.'));
		} finally {
			busy = false;
		}
	}

	function send(times: string[]) {
		void run(
			() => host.api.tournaments.proposeTimes(item.tournament.id, item.match.id, times),
			t('Times sent to {name}.', { name })
		);
	}

	function accept(time: string) {
		if (!proposal) {
			return;
		}

		const id = proposal.id;
		void run(
			() => host.api.tournaments.acceptTime(item.tournament.id, item.match.id, id, time),
			t('Match time set.')
		);
	}

	function decline() {
		if (!proposal) {
			return;
		}

		const id = proposal.id;
		void run(
			() => host.api.tournaments.declineTimes(item.tournament.id, item.match.id, id),
			t('Times declined.')
		);
	}
</script>

<!-- The bar holds the status and actions; proposals and the form follow as flush full-width rows. -->
<div class={cn('flex min-w-0 flex-col text-sm', className)}>
	<div class="flex flex-wrap items-center gap-2 bg-gray-950/40 px-4 py-1.5">
		{#if item.opponent}
			{@const profile = `https://steamcommunity.com/profiles/${item.opponent.steamId}`}
			{@const friend = `steam://friends/add/${item.opponent.steamId}`}
			{#if phase === 'agreed' && agreedAt}
				<span class="flex items-center gap-1.5 text-xs text-white">
					<CalendarBlankIcon class="text-primary size-4" weight="duotone" />
					{t('Match time: {date}', { date: when(agreedAt) })}
				</span>
				<Badge class="shrink-0">
					{Date.parse(agreedAt) > now
						? t('Starts in {time}', { time: timeLeft(t, agreedAt, now) })
						: t('Starting now')}
				</Badge>
			{:else if phase === 'waiting'}
				<span class="text-secondary-400 flex items-center gap-1.5 text-xs">
					<ClockIcon class="size-4" />
					{t('Waiting for {name} to pick a time', { name })}
				</span>
			{:else if phase === 'respond'}
				<span class="text-primary flex items-center gap-1.5 text-xs font-medium">
					<CalendarBlankIcon class="size-4" weight="duotone" />
					{t('{name} proposed a time for your match', { name })}
				</span>
			{:else}
				<span class="text-secondary-500 me-1 text-xs">
					{t('Arrange a time with {name}', { name })}
				</span>
			{/if}
			<Button
				href={profile}
				target="_blank"
				rel="noopener noreferrer"
				size="sm"
				variant="ghost"
				onclick={(event: MouseEvent) => external(event, profile)}
			>
				<SteamLogoIcon class="size-4" />
				{t('Steam profile')}
			</Button>
			<Button
				href={friend}
				size="sm"
				variant="ghost"
				onclick={(event: MouseEvent) => external(event, friend)}
			>
				<UserPlusIcon class="size-4" />
				{t('Add as friend')}
			</Button>
			{#if !formOpen}
				{#if tooLate}
					{#if phase === 'respond'}
						<Button size="sm" variant="ghost" disabled={busy} onclick={decline}>
							{t('Decline')}
						</Button>
					{/if}
				{:else if phase === 'none'}
					<Button size="sm" variant="secondary" onclick={openForm}>
						<CalendarBlankIcon class="size-4" />
						{t('Propose times')}
					</Button>
				{:else if phase === 'waiting'}
					<Button size="sm" variant="ghost" onclick={openForm}>
						{t('Change times')}
					</Button>
				{:else if phase === 'respond'}
					<Button size="sm" variant="ghost" disabled={busy} onclick={openForm}>
						{t('Propose other times')}
					</Button>
					<Button size="sm" variant="ghost" disabled={busy} onclick={decline}>
						{t('Decline')}
					</Button>
				{:else}
					<Button size="sm" variant="ghost" onclick={openForm}>
						{t('Propose a new time')}
					</Button>
				{/if}
			{/if}
		{/if}
		{#if trailing}
			<div class="ml-auto flex items-center">{@render trailing()}</div>
		{/if}
	</div>
	{#if item.opponent}
		{#if proposal && !formOpen}
			<ul>
				{#each proposal.times as time, index (time)}
					<li class="border-secondary-800 flex items-center gap-3 border-t px-4 py-2">
						<span class="text-secondary-500 w-16 shrink-0 text-xs">
							{t('Time {number}', { number: index + 1 })}
						</span>
						<ClockIcon class="text-secondary-500 size-4 shrink-0" />
						<span class="text-white tabular-nums">{when(time)}</span>
						{#if phase === 'respond'}
							<Button
								size="sm"
								class="ml-auto"
								disabled={busy || Date.parse(time) <= now}
								onclick={() => accept(time)}
							>
								<CheckIcon class="size-4" />
								{t('Accept')}
							</Button>
						{/if}
					</li>
				{/each}
			</ul>
			{#if agreedAt}
				<p class="border-secondary-800 text-secondary-400 border-t px-4 py-2 text-xs">
					{t('Current match time: {date}', { date: when(agreedAt) })}
				</p>
			{/if}
		{/if}
		{#if tooLate && phase !== 'agreed'}
			<p class="border-secondary-800 text-secondary-400 border-t px-4 py-2 text-xs">
				{t('The deadline is too close to propose a time. Contact staff.')}
			</p>
		{/if}
		{#if formOpen}
			<TournamentScheduleForm {item} {busy} onSend={send} onCancel={() => (proposing = false)} />
		{/if}
	{/if}
</div>
