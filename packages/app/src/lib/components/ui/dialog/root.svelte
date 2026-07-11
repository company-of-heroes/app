<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { dialog } from './dialog.svelte';
	import { cn } from '$lib/utils';
	import { overlayBackdrop, surfaceModal } from '../variants';
	import CloseIcon from 'phosphor-svelte/lib/X';
	import {
		isSelectionPickerTarget,
		selectionPicker
	} from '$lib/components/ui/input/selection-picker';
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
				'text-secondary-100 rounded-tl-xl rounded-bl-xl',
				surfaceModal,
				'outline-hidden sm:max-w-[420px] md:w-full'
			)}
		>
			{#if dialog.title}
				<Dialog.Title class="p-6">
					<div class="flex items-center justify-between">
						{#if typeof dialog.title === 'string'}
							<h3 class="font-bold not-visited:text-lg">{dialog.title}</h3>
						{:else}
							{@render dialog.title()}
						{/if}
						<Dialog.Close class="cursor-pointer rounded-md bg-secondary-800 p-1.5 hover:bg-secondary-700">
							<CloseIcon size="24" />
						</Dialog.Close>
					</div>
					{#if dialog.description}
						<Dialog.Description class="text-secondary-500">
							{#if typeof dialog.description === 'string'}
								{dialog.description}
							{:else}
								{@render dialog.description()}
							{/if}
						</Dialog.Description>
					{/if}
				</Dialog.Title>
			{/if}
			<div class="px-6 pb-6">
				<svelte:component this={dialog.component} {...dialog.props} />
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
