<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { cn } from '$lib/utils';
	import { overlayBackdrop, surfaceModal } from '../variants';
	import { modal } from './modal.svelte.js';
	import { H } from '../h';
	import CloseIcon from 'phosphor-svelte/lib/X';
</script>

<Dialog.Root bind:open={modal.isOpen}>
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
				'top-0 left-1/2 z-50 mx-auto mt-12 -translate-x-1/2 rounded-xl outline-hidden',
				'max-h-[calc(100vh-4rem)]',
				surfaceModal,
				modal.size === 'sm' && 'w-[320px]',
				modal.size === 'md' && 'w-[480px]',
				modal.size === 'lg' && 'w-[640px]',
				modal.size === 'xl' && 'w-[800px]',
				modal.size === 'full' && 'w-[calc(100vw-4rem)]'
			)}
			{...modal.contentProps}
		>
			{#if modal.title}
				<Dialog.Title class="sticky top-0 z-10 p-6">
					<div class="flex items-start justify-between gap-4">
						<div>
							{#if typeof modal.title === 'function'}
								{@render modal.title()}
							{:else}
								<H level="4">{modal.title}</H>
							{/if}
							{#if modal.description}
								<Dialog.Description class="mt-1 text-secondary-400">
									{#if typeof modal.description === 'function'}
										{@render modal.description()}
									{:else}
										{@html modal.description}
									{/if}
								</Dialog.Description>
							{/if}
						</div>
						{#if false === modal.hideCloseButton}
							<Dialog.Close
								class="cursor-pointer rounded-md bg-secondary-800 p-1.5 transition outline-none hover:bg-secondary-700"
							>
								<CloseIcon size={24} />
							</Dialog.Close>
						{/if}
					</div>
				</Dialog.Title>
			{/if}
			<div class="max-h-[calc(100vh-12rem)] overflow-y-auto px-6 pb-6">
				<svelte:component this={modal.component} {...modal.props} />
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
