<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { flushHeader, flushHeaderTitle } from '@company-of-heroes/ui/variants';
	import HeartIcon from 'phosphor-svelte/lib/HeartIcon';
	import { formatDate, parseDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { Checkbox } from '../ui/input';
	import type { SupporterStatus } from './types';

	type Props = {
		status: SupporterStatus;
		/** Open the customer portal (cancel, change card). */
		onmanage: () => void | Promise<void>;
		/** Show or hide the account on the public supporters page. */
		onhidden: (hidden: boolean) => void | Promise<void>;
	};

	let { status, onmanage, onhidden }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	// What the user just chose, until the host hands over a fresh status.
	let chosen = $state<boolean | null>(null);
	const hidden = $derived(chosen ?? status.hidden);
	let managing = $state(false);
	let saving = $state(false);

	// Cancelled at period end, Paddle keeps the subscription `active` (medal included) until
	// `endsAt`; then it turns `canceled` and the section offers to subscribe again.
	const periodEnd = $derived(parseDate(status.currentPeriodEnd));
	const date = (value: string | null) =>
		formatDate(value, host.locale(), 'date', { timeZone: 'UTC' });
	const months = $derived(
		status.months === 1 ? t('1 month') : t('{count} months', { count: status.months })
	);
	const summary = $derived(
		[
			status.since ? t('Supporter since {date}', { date: date(status.since) }) : null,
			months,
			status.endsAt
				? t('Ends on {date}', { date: date(status.endsAt) })
				: periodEnd
					? t('Next payment on {date}', { date: date(status.currentPeriodEnd) })
					: null
		]
			.filter(Boolean)
			.join(' · ')
	);

	/** Error (or a SvelteKit HttpError from a remote command, which has `body.message`) to text. */
	function errorMessage(error: unknown): string {
		if (error instanceof Error) {
			return error.message;
		}

		const message = (error as { body?: { message?: unknown } } | null)?.body?.message;
		return typeof message === 'string' && message ? message : t('Something went wrong');
	}

	async function manage() {
		managing = true;
		try {
			await onmanage();
		} catch (error) {
			host.notify.error(errorMessage(error));
		} finally {
			managing = false;
		}
	}

	async function setHidden(next: boolean) {
		const previous = chosen;
		chosen = next;
		saving = true;
		try {
			await onhidden(next);
		} catch (error) {
			chosen = previous;
			host.notify.error(errorMessage(error));
		} finally {
			saving = false;
		}
	}
</script>

<section>
	<div class={cn(flushHeader, 'flex items-center gap-2')}>
		<HeartIcon size={14} weight="fill" class="text-primary shrink-0" />
		<p class={flushHeaderTitle}>{t('Supporter')}</p>
	</div>
	{#if status.active}
		<div
			class="border-secondary-800 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
		>
			<p class="text-secondary-200 text-sm">{summary}</p>
			<Button variant="secondary" loading={managing} onclick={manage}>
				{t('Manage subscription')}
			</Button>
		</div>
		<div class="flex flex-col gap-1 px-4 py-3">
			<Checkbox
				size="sm"
				checked={hidden}
				disabled={saving}
				onCheckedChange={setHidden}
				label={t('Hide me from the supporters page')}
			/>
			<p class="text-secondary-500 text-xs">{t('Your medal stays visible.')}</p>
		</div>
	{:else}
		<div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
			<p class="text-secondary-400 text-sm">
				{t('Support coh1stats and get a few things in return.')}
			</p>
			{#if host.openSupporters}
				<div class="flex flex-wrap items-center gap-2">
					<Button variant="ghost" onclick={() => host.openSupporters?.()}>
						{t('Supporters')}
					</Button>
					<Button onclick={() => host.openSupporters?.({ checkout: true })}>
						<HeartIcon size={16} weight="fill" />
						{t('Become a supporter')}
					</Button>
				</div>
			{/if}
		</div>
	{/if}
</section>
