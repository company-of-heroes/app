<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { dialog } from './dialog.svelte';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderDescription,
		flushHeaderTitle,
		overlayBackdrop,
		surfaceModal
	} from '../../variants';
	import CloseIcon from 'phosphor-svelte/lib/XIcon';
	import {
		isSelectionPickerTarget,
		selectionPicker
	} from '../input/selection-picker';
</script>

<Dialog.Root bind:open={dialog.open}>
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
				'data-[state=open]:animate-in data-[state=open]:slide-in-from-right fixed',
				'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right',
				'top-0 right-0 z-50 h-screen w-screen max-w-[calc(100%-2rem)]',
				'text-secondary-100 rounded-l-md',
				surfaceModal,
				'outline-hidden sm:max-w-[420px] md:w-full'
			)}
		>
			{#if dialog.title}
				<Dialog.Title class={cn(flushHeader, 'bg-gray-950')}>
					<div class="flex items-start justify-between gap-4">
						<div class="min-w-0">
							{#if typeof dialog.title === 'string'}
								<p class={flushHeaderTitle}>{dialog.title}</p>
							{:else}
								{@render dialog.title()}
							{/if}
							{#if dialog.description}
								<Dialog.Description
									class={cn(flushHeaderDescription, 'whitespace-pre-line')}
								>
									{#if typeof dialog.description === 'string'}
										{dialog.description}
									{:else}
										{@render dialog.description()}
									{/if}
								</Dialog.Description>
							{/if}
						</div>
						<Dialog.Close
							class="bg-secondary-800 hover:bg-secondary-700 cursor-pointer rounded-md p-1 transition outline-none"
						>
							<CloseIcon size={20} />
						</Dialog.Close>
					</div>
				</Dialog.Title>
			{/if}
			<div class="overflow-y-auto p-4">
				<svelte:component this={dialog.component} {...dialog.props} />
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
