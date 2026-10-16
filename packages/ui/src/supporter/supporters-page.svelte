<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { flushHeader, flushHeaderTitle, tableHeadText } from '@company-of-heroes/ui/variants';
	import HeartIcon from 'phosphor-svelte/lib/HeartIcon';
	import { onMount } from 'svelte';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import SupporterList from './supporter-list.svelte';
	import SupporterPerks from './supporter-perks.svelte';
	import type { SupporterStatus, SupportersList } from './types';

	type Props = {
		list: SupportersList;
		/** The signed-in user's status; null when signed out. */
		status: SupporterStatus | null;
		/** Back from the checkout: thank the user and wait for the payment to land. */
		welcome?: boolean;
		/** Become a supporter: the host signs the user in first, or opens the checkout. */
		onsubscribe: () => void | Promise<void>;
		/** Open the customer portal. */
		onmanage: () => void | Promise<void>;
		/** Reloads the signed-in user's status (polled after the checkout). */
		loadStatus: () => Promise<SupporterStatus>;
	};

	let { list, status, welcome = false, onsubscribe, onmanage, loadStatus }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	let polled = $state.raw<SupporterStatus | null>(null);
	let waiting = $state(false);
	let busy = $state(false);
	const current = $derived(polled ?? status);
	const active = $derived(current?.active ?? false);

	// The webhook may land a few seconds after the redirect: ask up to 5 times, 2 s apart.
	onMount(() => {
		if (!welcome || !status || status.active) {
			return;
		}

		let stopped = false;
		waiting = true;
		(async () => {
			for (let attempt = 0; attempt < 5 && !stopped; attempt += 1) {
				await new Promise((resolve) => setTimeout(resolve, 2000));
				try {
					const next = await loadStatus();
					if (stopped) {
						return;
					}

					polled = next;
					if (next.active) {
						break;
					}
				} catch {
					// Try again on the next round.
				}
			}

			waiting = false;
		})();

		return () => {
			stopped = true;
		};
	});

	async function run(action: () => void | Promise<void>) {
		busy = true;
		try {
			await action();
		} catch (error) {
			host.notify.error(error instanceof Error ? error.message : t('Something went wrong'));
		} finally {
			busy = false;
		}
	}
</script>

<header class="border-secondary-800 relative isolate shrink-0 overflow-hidden border-b">
	<div
		class="from-primary/15 pointer-events-none absolute inset-0 -z-10 bg-radial-[at_15%_0%] via-transparent to-transparent"
	></div>
	<HeartIcon
		weight="duotone"
		class="text-primary/5 pointer-events-none absolute -top-6 right-4 -z-10 hidden size-56 sm:block"
	/>
	<div
		class="flex flex-col gap-6 px-4 pt-10 pb-6 sm:flex-row sm:items-end sm:justify-between sm:pt-14"
	>
		<div class="flex min-w-0 flex-col gap-2">
			<span class={cn(tableHeadText, 'text-primary')}>{t('Community')}</span>
			<h1 class="font-heading text-3xl leading-tight font-bold text-white sm:text-4xl">
				{t('Supporters')}
			</h1>
			<p class="text-secondary-400 max-w-2xl text-sm">
				{t(
					'coh1stats is built and paid for by one person. Supporters keep the servers running and get a few things in return.'
				)}
			</p>
		</div>
		<div class="flex shrink-0 flex-col gap-3 sm:items-end">
			<p class="font-heading text-3xl font-bold text-white">{t('€5 / month')}</p>
			<div class="flex flex-wrap items-center gap-2">
				{#if active}
					<Badge variant="success">{t('You are a supporter')}</Badge>
					<Button variant="secondary" loading={busy} onclick={() => run(onmanage)}>
						{t('Manage subscription')}
					</Button>
				{:else}
					<Button loading={busy} onclick={() => run(onsubscribe)}>
						<HeartIcon size={16} weight="fill" />
						{t('Become a supporter')}
					</Button>
				{/if}
			</div>
		</div>
	</div>
</header>

{#if welcome}
	<div class="border-secondary-800 flex items-center gap-2 border-b px-4 py-3 text-sm">
		<HeartIcon size={16} weight="fill" class="text-primary shrink-0" />
		<p class="text-secondary-200">
			{#if active}
				{t('Thank you for supporting coh1stats! Your medal is on.')}
			{:else if waiting}
				{t('Thank you for supporting coh1stats! We are confirming your payment…')}
			{:else}
				{t(
					'Thank you for supporting coh1stats! Your payment is being processed; your medal shows up shortly.'
				)}
			{/if}
		</p>
	</div>
{/if}

<SupporterPerks />

<div class={cn(flushHeader, 'flex items-center gap-2')}>
	<p class={flushHeaderTitle}>{t('Current supporters')}</p>
	{#if list.current.length > 0}
		<span class="text-secondary-500 text-xs tabular-nums">{list.current.length}</span>
	{/if}
</div>
<SupporterList entries={list.current} empty={t('No supporters yet. Be the first!')} />

<div class={cn(flushHeader, 'flex items-center gap-2')}>
	<p class={flushHeaderTitle}>{t('Hall of fame')}</p>
	{#if list.former.length > 0}
		<span class="text-secondary-500 text-xs tabular-nums">{list.former.length}</span>
	{/if}
</div>
<SupporterList entries={list.former} empty={t('Former supporters will be remembered here.')} last />
