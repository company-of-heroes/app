<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import FlagBannerIcon from 'phosphor-svelte/lib/FlagBannerIcon';
	import SwordIcon from 'phosphor-svelte/lib/SwordIcon';
	import { onMount } from 'svelte';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { modal } from '../ui/modal';
	import { fireConfetti } from './confetti';
	import { roundLabel } from './format';
	import type { TournamentStart } from './types';

	type Props = { start: TournamentStart };

	let { start }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const item = $derived(start.match);

	onMount(() => {
		fireConfetti(80);
	});
</script>

<div class="flex flex-col">
	<div class="relative isolate overflow-hidden px-5 pt-6 pb-5 text-center">
		{#if start.tournament.bannerUrl}
			<img
				src={start.tournament.bannerUrl}
				alt=""
				class="absolute inset-0 -z-20 size-full object-cover opacity-30"
			/>
		{/if}
		<div
			class="from-primary/25 pointer-events-none absolute inset-0 -z-10 bg-radial-[at_50%_0%] to-transparent"
		></div>
		{#if start.tournament.logoUrl}
			<img
				src={start.tournament.logoUrl}
				alt=""
				class="border-secondary-700 mx-auto mb-3 size-14 rounded border object-cover"
			/>
		{:else}
			<FlagBannerIcon weight="duotone" class="text-primary mx-auto mb-3 size-12" />
		{/if}
		<p class="text-secondary-400 text-sm">
			{t('{count} players', { count: start.tournament.participantCount })}
		</p>
		<h2 class="font-heading mt-1 text-3xl leading-tight font-bold text-white">
			{t('{name} has started!', { name: start.tournament.name })}
		</h2>
		<p class="text-secondary-300 mt-1 text-sm">{t('Good luck, commander.')}</p>
	</div>

	<div class="border-secondary-800 flex items-start gap-3 border-y px-5 py-4">
		<SwordIcon weight="duotone" class="text-primary mt-0.5 size-5 shrink-0" />
		{#if item}
			<div class="flex min-w-0 flex-col gap-1 text-sm">
				<p class="text-white">
					{roundLabel(t, item.tournament.format, item.match, item.rounds || item.match.round)}:
					{t('you against {name}', { name: item.opponent?.alias ?? t('your opponent') })}
					<span class="text-secondary-400">
						({t('Best of {count}', { count: item.match.bestOf })})
					</span>
				</p>
				{#if item.match.deadline}
					<p class="text-secondary-300">
						{t('Play before {date}.', {
							date: formatDate(item.match.deadline, host.locale(), 'dateTime')
						})}
					</p>
				{/if}
				<p class="text-secondary-400">
					{t(
						'Open the desktop app and click "Start tournament game" on the dashboard before you start the lobby. The game then counts automatically.'
					)}
				</p>
			</div>
		{:else}
			<p class="text-secondary-300 text-sm">
				{t('Your first match is not ready yet. We let you know when it is your turn.')}
			</p>
		{/if}
	</div>

	<div class="flex flex-wrap justify-end gap-2 px-5 py-4">
		<Button variant="ghost" onclick={() => modal.close()}>{t('Close')}</Button>
		<Button href={host.routes.tournament(start.tournament.slug)} onclick={() => modal.close()}>
			{t('View tournament')}
		</Button>
	</div>
</div>
