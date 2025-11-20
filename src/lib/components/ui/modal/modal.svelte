<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { cn } from '$lib/utils';
	import { modal } from './modal.svelte.js';
	import { H } from '../h';
	import CloseIcon from 'phosphor-svelte/lib/X';
</script>

<Dialog.Root bind:open={modal.isOpen}>
	<Dialog.Portal>
		<Dialog.Overlay
			class={cn(
				'fixed inset-0 z-50 bg-gray-950/60 backdrop-blur-lg',
				'data-[state=open]:animate-in data-[state=open]:fade-in-0',
				'data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
			)}
		/>
		<Dialog.Content
			class={cn(
				'data-[state=open]:animate-in data-[state=open]:zoom-in fixed duration-75',
				'data-[state=closed]:animate-out data-[state=closed]:zoom-out data-[state=closed]:fade-out',
				'top-1/2 right-1/2 z-50 translate-x-1/2 -translate-y-1/2 rounded-xl shadow-lg',
				'bg-gray-800 outline-hidden',
				modal.size === 'sm' && 'w-[320px]',
				modal.size === 'md' && 'w-[480px]',
				modal.size === 'lg' && 'w-[640px]',
				modal.size === 'xl' && 'w-[800px]',
				modal.size === 'full' && 'w-[calc(100vw-4rem)]'
			)}
			{...modal.contentProps}
		>
			{#if modal.title}
				<Dialog.Title class="p-6">
					<div class="flex items-start justify-between gap-4">
						<div>
							{#if typeof modal.title === 'function'}
								{@render modal.title()}
							{:else}
								<H level="4">{modal.title}</H>
							{/if}
							{#if modal.description}
								<Dialog.Description class="mt-1 text-gray-400">
									{#if typeof modal.description === 'function'}
										{@render modal.description()}
									{:else}
										{modal.description}
									{/if}
								</Dialog.Description>
							{/if}
						</div>
						{#if false === modal.hideCloseButton}
							<Dialog.Close
								class="cursor-pointer rounded-md bg-gray-700 p-1.5 transition outline-none hover:bg-gray-600"
							>
								<CloseIcon size={24} />
							</Dialog.Close>
						{/if}
					</div>
				</Dialog.Title>
			{/if}
			<div class="px-6 pb-6">
				<svelte:component this={modal.component} {...modal.props} />
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
