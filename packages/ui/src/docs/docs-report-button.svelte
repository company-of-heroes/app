<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { Dialog } from 'bits-ui';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderDescription,
		flushHeaderTitle,
		overlayBackdrop,
		surfaceModal
	} from '@company-of-heroes/ui/variants';
	import BugIcon from 'phosphor-svelte/lib/BugIcon';
	import CloseIcon from 'phosphor-svelte/lib/XIcon';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { Textarea } from '../ui/input';
	import { Label } from '../ui/label';
	import { tooltip } from '../attachments';

	type Props = {
		/** Name of the page being reported, shown to staff. */
		page: string;
		class?: string;
	};

	let { page, class: className }: Props = $props();
	const host = useHost();
	const { t } = useI18n();

	const REPORT_MAX = 2000;

	let open = $state(false);
	let description = $state('');
	let submitting = $state(false);

	const report = $derived(host.api.docs?.reportIssue);
	const canSubmit = $derived(description.trim().length > 0 && !submitting);

	function onOpenChange(next: boolean) {
		if (submitting) {
			return;
		}

		open = next;
		if (next) {
			description = '';
		}
	}

	async function submit() {
		if (!report || !canSubmit) {
			return;
		}

		submitting = true;
		try {
			await report(page, description.trim());
			open = false;
			host.notify.success(t('Thanks, staff will look at your report.'));
		} catch (error) {
			host.notify.error(error instanceof Error ? error.message : t('Could not send the report.'));
		} finally {
			submitting = false;
		}
	}
</script>

{#snippet label()}
	<BugIcon size={16} weight="duotone" />
	<span class="hidden sm:inline">{t('Report issue')}</span>
{/snippet}

{#if report}
	{#if host.auth.user}
		<Button
			variant="ghost"
			size="sm"
			class={className}
			{@attach tooltip(t('Report wrong info on this page'))}
			onclick={() => onOpenChange(true)}
		>
			{@render label()}
		</Button>
	{:else}
		<Button
			variant="ghost"
			size="sm"
			class={className}
			href={host.routes.login()}
			{@attach tooltip(t('Sign in to report an issue.'))}
		>
			{@render label()}
		</Button>
	{/if}

	<Dialog.Root {open} {onOpenChange}>
		<Dialog.Portal>
			<Dialog.Overlay
				class={cn(
					overlayBackdrop,
					'fixed inset-0 z-50',
					'flex items-center justify-center overflow-y-auto p-4'
				)}
			/>
			<Dialog.Content
				class={cn(
					'absolute',
					'top-0 left-1/2 z-50 mx-auto mt-12 w-[480px] max-w-[calc(100%-2rem)] -translate-x-1/2 overflow-hidden outline-hidden',
					surfaceModal
				)}
			>
				<Dialog.Title class={cn(flushHeader, 'sticky top-0 z-10 bg-gray-950')}>
					<div class="flex items-start justify-between gap-4">
						<div class="min-w-0">
							<p class={flushHeaderTitle}>{t('Report issue')}</p>
							<Dialog.Description class={flushHeaderDescription}>
								{t('Tell staff what is wrong on {page}.', { page })}
							</Dialog.Description>
						</div>
						<Dialog.Close
							class="bg-secondary-800 hover:bg-secondary-700 cursor-pointer rounded-md p-1 transition outline-none"
							aria-label={t('Close')}
						>
							<CloseIcon size={20} />
						</Dialog.Close>
					</div>
				</Dialog.Title>
				<form
					class="flex flex-col gap-4 p-4"
					onsubmit={(event) => {
						event.preventDefault();
						void submit();
					}}
				>
					<div class="flex flex-col gap-2">
						<Label for="docs-report-description">{t('Description')}</Label>
						<Textarea
							id="docs-report-description"
							bind:value={description}
							rows={6}
							maxlength={REPORT_MAX}
							placeholder={t(
								'What is wrong? For example a stat, cost or description that does not match the game.'
							)}
							required
						/>
						<span class="text-secondary-500 text-xs tabular-nums">
							{description.length} / {REPORT_MAX}
						</span>
					</div>
					<div class="flex justify-end gap-2">
						<Button
							type="button"
							variant="secondary"
							disabled={submitting}
							onclick={() => onOpenChange(false)}
						>
							{t('Cancel')}
						</Button>
						<Button type="submit" disabled={!canSubmit} loading={submitting}>
							{t('Send report')}
						</Button>
					</div>
				</form>
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>
{/if}
