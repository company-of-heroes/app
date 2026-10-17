<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { flushHeader, flushHeaderTitle } from '@company-of-heroes/ui/variants';
	import HeartIcon from 'phosphor-svelte/lib/HeartIcon';
	import HourglassIcon from 'phosphor-svelte/lib/HourglassIcon';
	import QuestionIcon from 'phosphor-svelte/lib/QuestionIcon';
	import XCircleIcon from 'phosphor-svelte/lib/XCircleIcon';
	import { onMount } from 'svelte';
	import { useHost } from '../host/host.context';
	import PlayerSupporterMedal from '../player/player-supporter-medal.svelte';
	import { Button } from '../ui/button';
	import type { CheckoutState } from './types';

	type Props = {
		/** The payment's state when the page loaded. */
		state: CheckoutState;
		/** Asks again (polled while the payment is pending). */
		loadState: () => Promise<CheckoutState>;
		/** Start a new checkout after a failed, cancelled or expired payment. */
		onretry: () => Promise<void>;
		supportersHref: string;
		accountHref: string;
	};

	let { state: initial, loadState, onretry, supportersHref, accountHref }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
	const medalUrl = host.resolve.supporterMedal();

	let current = $derived(initial);
	let retrying = $state(false);

	const failed = $derived(current === 'failed' || current === 'canceled' || current === 'expired');
	const title = $derived(
		{
			paid: t('Thank you for supporting coh1stats!'),
			pending: t('Your payment is being processed'),
			failed: t('Your payment failed'),
			canceled: t('Payment cancelled'),
			expired: t('Payment expired'),
			unknown: t('We could not find your payment')
		}[current]
	);
	const message = $derived(
		{
			paid: t('Your payment went through and your medal is on.'),
			pending: t(
				'This can take a moment. Your medal shows up as soon as the payment is confirmed.'
			),
			failed: t('Nothing was charged. Try again, or pick another payment method.'),
			canceled: t('You cancelled the payment. Nothing was charged.'),
			expired: t('The payment was not completed in time. Nothing was charged.'),
			unknown: t('If you just paid, your medal shows up shortly. Otherwise, start a new checkout.')
		}[current]
	);

	// Mollie may confirm a few seconds after the redirect: ask every 2 s, for about a minute.
	onMount(() => {
		if (current !== 'pending') {
			return;
		}

		let stopped = false;
		(async () => {
			for (let attempt = 0; attempt < 30 && !stopped; attempt += 1) {
				await new Promise((resolve) => setTimeout(resolve, 2000));
				try {
					const next = await loadState();
					if (stopped) {
						return;
					}

					current = next;
					if (next !== 'pending') {
						break;
					}
				} catch {
					// Try again on the next round.
				}
			}
		})();

		return () => {
			stopped = true;
		};
	});

	/** Error (or a SvelteKit HttpError from a remote command, which has `body.message`) to text. */
	function errorMessage(error: unknown): string {
		if (error instanceof Error) {
			return error.message;
		}

		const message = (error as { body?: { message?: unknown } } | null)?.body?.message;
		return typeof message === 'string' && message ? message : t('Something went wrong');
	}

	async function retry() {
		retrying = true;
		try {
			await onretry();
		} catch (error) {
			host.notify.error(errorMessage(error));
			retrying = false;
		}
	}
</script>

<section>
	<div class={cn(flushHeader, 'flex items-center gap-2')}>
		<HeartIcon size={14} weight="fill" class="text-primary shrink-0" />
		<p class={flushHeaderTitle}>{t('Supporter')}</p>
	</div>
	<div
		class={cn(
			'flex flex-col items-center gap-4 px-4 py-12 text-center sm:py-16',
			current === 'paid' && 'from-primary/10 bg-linear-to-b to-transparent'
		)}
		role={failed ? 'alert' : 'status'}
	>
		{#if current === 'paid'}
			{#if medalUrl}
				<PlayerSupporterMedal force size={96} />
			{:else}
				<HeartIcon size={56} weight="fill" class="text-primary" />
			{/if}
		{:else if current === 'pending'}
			<HourglassIcon size={56} weight="duotone" class="text-secondary-300 animate-pulse" />
		{:else if failed}
			<XCircleIcon size={56} weight="duotone" class="text-destructive" />
		{:else}
			<QuestionIcon size={56} weight="duotone" class="text-secondary-400" />
		{/if}
		<div class="flex max-w-md flex-col gap-2">
			<h1 class="font-heading text-2xl font-bold text-white">{title}</h1>
			<p class="text-secondary-300 text-sm">{message}</p>
		</div>
		<div class="flex flex-wrap items-center justify-center gap-2">
			{#if current === 'paid'}
				<Button variant="ghost" href={accountHref}>{t('Go to your account')}</Button>
				<Button href={supportersHref}>{t('See the supporters')}</Button>
			{:else if current === 'pending'}
				<Button variant="ghost" href={supportersHref}>{t('Back to supporters')}</Button>
			{:else}
				<Button variant="ghost" href={supportersHref}>{t('Back to supporters')}</Button>
				<Button loading={retrying} onclick={retry}>
					<HeartIcon size={16} weight="fill" />
					{t('Try again')}
				</Button>
			{/if}
		</div>
	</div>
</section>
