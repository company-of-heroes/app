<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import HourglassIcon from 'phosphor-svelte/lib/HourglassMediumIcon';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { modal } from '../ui/modal';
	import { deadlineState, roundLabel, timeLeft } from './format';
	import type { MyTournamentMatch } from './types';

	type Props = { item: MyTournamentMatch };

	let { item }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const state = $derived(deadlineState(item.match));
	const played = $derived(item.match.winsA + item.match.winsB);
</script>

<div class="flex flex-col">
	<div class="flex gap-4 px-5 pt-6 pb-5">
		<span
			class={cn(
				'flex size-12 shrink-0 items-center justify-center rounded-full',
				state === 'open' ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive'
			)}
		>
			<HourglassIcon size={26} weight="duotone" />
		</span>
		<div class="flex min-w-0 flex-col gap-1">
			<p class="text-secondary-400 text-sm">
				{item.tournament.name}
				<span class="text-secondary-600 px-1">/</span>
				{roundLabel(t, item.tournament.format, item.match, item.rounds || item.match.round)}
			</p>
			<h2 class="font-heading text-2xl leading-tight font-bold text-white">
				{state === 'overdue'
					? t('Your tournament match is overdue')
					: t('{time} left to play', { time: timeLeft(t, item.match.deadline ?? '') })}
			</h2>
			<p class="text-secondary-300 text-sm">
				{t('Play against {name} before {date}.', {
					name: item.opponent?.alias ?? t('your opponent'),
					date: item.match.deadline
						? formatDate(item.match.deadline, host.locale(), 'dateTime')
						: '—'
				})}
				{#if played > 0}
					{t('Score so far: {a} – {b}.', { a: item.match.winsA, b: item.match.winsB })}
				{/if}
			</p>
		</div>
	</div>
	<p class="text-secondary-300 border-secondary-800 border-y px-5 py-3 text-sm">
		{t(
			'Open the desktop app and click "Start tournament game" on the dashboard before you start the lobby. The game then counts automatically.'
		)}
	</p>
	<div class="flex flex-wrap justify-end gap-2 px-5 py-4">
		<Button variant="ghost" onclick={() => modal.close()}>{t('Close')}</Button>
		<Button href={host.routes.tournament(item.tournament.slug)} onclick={() => modal.close()}>
			{t('View tournament')}
		</Button>
	</div>
</div>
