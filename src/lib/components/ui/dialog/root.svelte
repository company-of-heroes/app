<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog, type WithoutChild } from 'bits-ui';
	import { dialog } from './dialog.svelte';
	import { cn } from '$lib/utils';
	import CloseIcon from 'phosphor-svelte/lib/X';
</script>

<Dialog.Root bind:open={dialog.open}>
	<Dialog.Portal>
		<Dialog.Overlay
			class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 bg-secondary-950/90 fixed inset-0 z-50"
		/>
		<Dialog.Content
			class={cn(
				'data-[state=open]:animate-in  data-[state=open]:fade-in-0  data-[state=open]:zoom-in-95 fixed',
				'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
				'top-[50%] left-[50%] z-50 w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%]',
				'bg-secondary-800 text-secondary-100',
				'outline-hidden sm:max-w-[490px] md:w-full'
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
						<Dialog.Close class="cursor-pointer">
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
				{@render dialog.component?.()}
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
