<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { AlertDialog } from 'bits-ui';
	import { Button } from '@company-of-heroes/ui/button';
	import { cn } from '@company-of-heroes/ui/cn';
	import { overlayBackdrop, surfaceModal } from '../../variants';
	import { confirmation } from './confirm.svelte';

	const { t } = useI18n();
	const request = $derived(confirmation.request);
</script>

<AlertDialog.Root
	open={confirmation.open}
	onOpenChange={(open) => {
		if (!open) {
			confirmation.answer(false);
		}
	}}
>
	<AlertDialog.Portal>
		<AlertDialog.Overlay class={cn(overlayBackdrop, 'fixed inset-0 z-50')} />
		<AlertDialog.Content
			class={cn(
				'fixed top-0 left-1/2 z-50 mt-12 w-[480px] max-w-[calc(100%-2rem)] -translate-x-1/2 overflow-hidden outline-hidden',
				surfaceModal
			)}
		>
			<AlertDialog.Description class="text-secondary-100 px-4 py-4 text-sm whitespace-pre-line">
				{request?.message}
			</AlertDialog.Description>
			<div class="border-secondary-800 flex justify-end gap-2 border-t px-4 py-3">
				<Button type="button" variant="secondary" onclick={() => confirmation.answer(false)}>
					{request?.options.cancel ?? t('Cancel')}
				</Button>
				<Button
					type="button"
					variant={request?.options.danger ? 'destructive' : 'primary'}
					onclick={() => confirmation.answer(true)}
				>
					{request?.options.confirm ?? t('OK')}
				</Button>
			</div>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
