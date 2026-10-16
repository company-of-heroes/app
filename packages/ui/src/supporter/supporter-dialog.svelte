<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { flushHeader, flushHeaderTitle, overlayBackdrop } from '@company-of-heroes/ui/variants';
	import HeartIcon from 'phosphor-svelte/lib/HeartIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { Dialog } from 'bits-ui';
	import SupporterPerks from './supporter-perks.svelte';

	type Props = {
		open: boolean;
		/** The user already supports: the dialog offers the portal instead of the checkout. */
		active?: boolean;
		/** Cancelled at period end: still a supporter until this ISO date. */
		endsAt?: string | null;
		/** Localized link to the supporters page (hosts without that route use `onsupporters`). */
		supportersHref?: string;
		/** Open the supporters page when the host has no route for it. */
		onsupporters?: () => void;
		/** Become a supporter: the host signs the user in first, or opens the checkout. */
		onsubscribe: () => void | Promise<void>;
		/** Open the customer portal. */
		onmanage: () => void | Promise<void>;
	};

	let {
		open = $bindable(false),
		active = false,
		endsAt = null,
		supportersHref,
		onsupporters,
		onsubscribe,
		onmanage
	}: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	let busy = $state(false);
	const endDate = $derived(
		endsAt ? formatDate(endsAt, host.locale(), 'date', { timeZone: 'UTC' }) : null
	);

	/** Error (or a SvelteKit HttpError from a remote command, which has `body.message`) to text. */
	function errorMessage(error: unknown): string | null {
		if (error instanceof Error) {
			return error.message;
		}

		const message = (error as { body?: { message?: unknown } } | null)?.body?.message;
		return typeof message === 'string' && message ? message : null;
	}

	async function run(action: () => void | Promise<void>) {
		busy = true;
		try {
			await action();
		} catch (error) {
			host.notify.error(errorMessage(error) ?? t('Something went wrong'));
		} finally {
			busy = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class={cn(overlayBackdrop, 'fixed inset-0 z-50')} />
		<Dialog.Content
			class="absolute top-0 left-1/2 z-50 mx-auto mt-12 flex max-h-[calc(100vh-6rem)] w-[720px] max-w-[calc(100%-2rem)] -translate-x-1/2 flex-col overflow-hidden"
		>
			<div class={cn(flushHeader, 'flex items-center justify-between gap-4')}>
				<Dialog.Title class={cn(flushHeaderTitle, 'flex items-center gap-2')}>
					<HeartIcon size={16} weight="fill" class="text-primary shrink-0" />
					{active ? t('Supporter') : t('Become a supporter')}
				</Dialog.Title>
				<Dialog.Close
					class="bg-secondary-800 hover:bg-secondary-700 cursor-pointer rounded-md p-1 transition outline-none"
					aria-label={t('Close')}
				>
					<XIcon size={20} />
				</Dialog.Close>
			</div>
			<div class="min-h-0 overflow-y-auto">
				<SupporterPerks />
				<div class="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
					<div class="flex flex-col gap-1">
						<p class="font-heading text-2xl font-bold text-white">{t('€4.99 / month')}</p>
						{#if active && endDate}
							<p class="text-secondary-400 text-sm">{t('Ends on {date}', { date: endDate })}</p>
						{/if}
					</div>
					<div class="flex flex-wrap items-center gap-2">
						<Button
							variant="ghost"
							href={supportersHref}
							onclick={() => {
								open = false;
								onsupporters?.();
							}}
						>
							{t('See the supporters')}
						</Button>
						{#if active}
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
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
