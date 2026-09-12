<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import { cn } from '@company-of-heroes/ui/cn';
	import { flushHeader, flushHeaderTitle, overlayBackdrop, surfaceModal } from '../../variants';
	import {
		isSelectionPickerTarget,
		selectionPicker
	} from '../input/selection-picker';
	import XIcon from 'phosphor-svelte/lib/XIcon';

	type Props = {
		open?: boolean;
		side?: 'left' | 'right';
		title?: string;
		closeLabel?: string;
		class?: string;
		children: Snippet;
	};

	let {
		open = $bindable(false),
		side = 'left',
		title,
		closeLabel = 'Close',
		class: className,
		children
	}: Props = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay
			class={cn(
				overlayBackdrop,
				'fixed inset-0 z-50',
				'data-[state=open]:animate-in data-[state=open]:fade-in-0',
				'data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
			)}
		/>
		<Dialog.Content
			trapFocus={!selectionPicker.isOpen}
			onInteractOutside={(e) => {
				if (isSelectionPickerTarget(e.target)) {
					e.preventDefault();
				}
			}}
			onEscapeKeydown={(e) => {
				if (selectionPicker.isOpen) {
					selectionPicker.handleParentEscape();
					e.preventDefault();
				}
			}}
			class={cn(
				surfaceModal,
				'fixed inset-y-0 z-50 flex w-80 max-w-[calc(100vw-1rem)] flex-col rounded-none outline-hidden',
				'data-[state=open]:animate-in data-[state=closed]:animate-out',
				side === 'left' &&
					'data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left left-0 border-r',
				side === 'right' &&
					'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right right-0 border-l',
				className
			)}
		>
			{#if title}
				<Dialog.Title class={cn(flushHeader, 'sticky top-0 z-10 bg-gray-950')}>
					<div class="flex items-start justify-between gap-4">
						<p class={flushHeaderTitle}>{title}</p>
						<Dialog.Close
							aria-label={closeLabel}
							class="bg-secondary-800 hover:bg-secondary-700 cursor-pointer rounded-md p-1 transition outline-none"
						>
							<XIcon size={20} />
						</Dialog.Close>
					</div>
				</Dialog.Title>
			{:else}
				<div class={cn(flushHeader, 'sticky top-0 z-10 flex justify-end bg-gray-950')}>
					<Dialog.Close
						aria-label={closeLabel}
						class="bg-secondary-800 hover:bg-secondary-700 cursor-pointer rounded-md p-1 transition outline-none"
					>
						<XIcon size={20} />
					</Dialog.Close>
				</div>
			{/if}
			<div class="min-h-0 flex-1 overflow-y-auto p-4">
				{@render children()}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
