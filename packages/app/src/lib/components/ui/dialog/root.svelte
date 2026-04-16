<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { dialog } from './dialog.svelte';
	import { cn } from '$lib/utils';
	import CloseIcon from 'phosphor-svelte/lib/X';
</script>

<Dialog.Root bind:open={dialog.open}>
	<Dialog.Portal>
		<Dialog.Overlay
			class={cn(
				'fixed inset-0 z-50 bg-gray-950/40 backdrop-blur-xl',
				'data-[state=open]:animate-in data-[state=open]:fade-in-0',
				'data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
			)}
		/>
		<Dialog.Content
			class={cn(
				'data-[state=open]:animate-in data-[state=open]:slide-in-from-right fixed',
				'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right',
				'top-0 right-0 z-50 h-screen w-screen max-w-[calc(100%-2rem)]',
				'text-secondary-100 rounded-tl-xl rounded-bl-xl bg-gray-800',
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
						<Dialog.Close class="cursor-pointer rounded-md bg-gray-700 p-1.5">
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
