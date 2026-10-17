<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';

	type Props = {
		/** Cancelled at period end: the button resumes instead of cancelling. */
		endsAt: string | null;
		/** Stop the monthly payments (asked for confirmation first). */
		oncancel: () => Promise<unknown>;
		/** Undo the cancel before the paid period ends. */
		onresume: () => Promise<unknown>;
		class?: string;
	};

	let { endsAt, oncancel, onresume, class: className }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	let busy = $state(false);

	/** Error (or a SvelteKit HttpError from a remote command, which has `body.message`) to text. */
	function errorMessage(error: unknown): string {
		if (error instanceof Error) {
			return error.message;
		}

		const message = (error as { body?: { message?: unknown } } | null)?.body?.message;
		return typeof message === 'string' && message ? message : t('Something went wrong');
	}

	async function run(action: () => Promise<unknown>, done: string) {
		busy = true;
		try {
			await action();
			host.notify.success(done);
		} catch (error) {
			host.notify.error(errorMessage(error));
		} finally {
			busy = false;
		}
	}

	async function cancel() {
		const confirmed = await host.notify.confirm(
			t('Stop your monthly payments? Your medal stays until the paid month ends.'),
			{ confirm: t('Cancel subscription'), cancel: t('Keep it'), danger: true }
		);
		if (!confirmed) {
			return;
		}

		await run(oncancel, t('Your subscription is cancelled.'));
	}
</script>

{#if endsAt}
	<Button
		class={className}
		variant="secondary"
		loading={busy}
		onclick={() => run(onresume, t('Your subscription continues.'))}
	>
		{t('Resume subscription')}
	</Button>
{:else}
	<Button class={className} variant="destructive" loading={busy} onclick={cancel}>
		{t('Cancel subscription')}
	</Button>
{/if}
