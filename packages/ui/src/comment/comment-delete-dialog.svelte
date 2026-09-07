<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { Button } from '@company-of-heroes/ui/button';
	import { Textarea } from '@company-of-heroes/ui/input';
	import { Label } from '@company-of-heroes/ui/label';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderDescription,
		flushHeaderTitle,
		overlayBackdrop,
		surfaceModal
	} from '@company-of-heroes/ui/variants';
	import { watch } from 'runed';
	import CloseIcon from 'phosphor-svelte/lib/XIcon';

	type Props = {
		open?: boolean;
		requireNote?: boolean;
		title?: string;
		description?: string;
		noteLabel?: string;
		notePlaceholder?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		closeLabel?: string;
		onconfirm: (note: string) => void | Promise<void>;
		oncancel?: () => void;
	};

	let {
		open = $bindable(false),
		requireNote = false,
		title = 'Delete comment',
		description = 'This comment will be hidden from other users.',
		noteLabel = 'Reason',
		notePlaceholder = 'Why is this comment being deleted?',
		confirmLabel = 'Save',
		cancelLabel = 'Cancel',
		closeLabel = 'Close',
		onconfirm,
		oncancel
	}: Props = $props();

	let note = $state('');
	let submitting = $state(false);
	const canConfirm = $derived(!requireNote || note.trim().length > 0);

	watch(
		() => open,
		(isOpen: boolean) => {
			if (isOpen) {
				note = '';
				submitting = false;
			}
		}
	);

	function onOpenChange(next: boolean) {
		open = next;
		if (!next) {
			note = '';
			submitting = false;
			oncancel?.();
		}
	}

	function cancel() {
		if (submitting) {
			return;
		}

		onOpenChange(false);
	}

	async function confirm() {
		if (!canConfirm || submitting) {
			return;
		}

		submitting = true;
		try {
			await onconfirm(note.trim());
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog.Root {open} onOpenChange={onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay
			class={cn(
				overlayBackdrop,
				'fixed inset-0 z-50',
				'data-[state=open]:animate-in data-[state=open]:fade-in-0',
				'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
				'flex items-center justify-center overflow-y-auto p-4'
			)}
		/>
		<Dialog.Content
			class={cn(
				'data-[state=open]:animate-in data-[state=open]:zoom-in absolute duration-75',
				'data-[state=closed]:animate-out data-[state=closed]:zoom-out data-[state=closed]:fade-out',
				'top-0 left-1/2 z-50 mx-auto mt-12 w-[480px] max-w-[calc(100%-2rem)] -translate-x-1/2 outline-hidden',
				surfaceModal
			)}
		>
			<Dialog.Title class={cn(flushHeader, 'sticky top-0 z-10 bg-gray-950')}>
				<div class="flex items-start justify-between gap-4">
					<div class="min-w-0">
						<p class={flushHeaderTitle}>{title}</p>
						<Dialog.Description class={cn(flushHeaderDescription, 'whitespace-pre-line')}>
							{description}
						</Dialog.Description>
					</div>
					<Dialog.Close
						class="bg-secondary-800 hover:bg-secondary-700 cursor-pointer rounded-md p-1 transition outline-none"
						aria-label={closeLabel}
					>
						<CloseIcon size={20} />
					</Dialog.Close>
				</div>
			</Dialog.Title>
			<form
				class="flex flex-col gap-4 p-4"
				onsubmit={(event) => {
					event.preventDefault();
					void confirm();
				}}
			>
				{#if requireNote}
					<div class="flex flex-col gap-2">
						<Label for="comment-delete-note">{noteLabel}</Label>
						<Textarea
							id="comment-delete-note"
							bind:value={note}
							rows={4}
							maxlength={500}
							placeholder={notePlaceholder}
							required
							autofocus
						/>
					</div>
				{/if}
				<div class="flex justify-end gap-2">
					<Button type="button" variant="secondary" onclick={cancel} disabled={submitting}>
						{cancelLabel}
					</Button>
					<Button
						type="submit"
						variant="destructive"
						disabled={!canConfirm}
						loading={submitting}
					>
						{confirmLabel}
					</Button>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
