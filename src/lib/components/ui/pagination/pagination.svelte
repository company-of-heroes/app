<script lang="ts">
	import { cn } from '$lib/utils';
	import { Pagination, type PaginationRootProps } from 'bits-ui';
	import CaretLeft from 'phosphor-svelte/lib/CaretLeft';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';

	let { page = $bindable<number>(), ...restProps }: PaginationRootProps = $props();
</script>

<Pagination.Root {...restProps} bind:page>
	{#snippet children({ pages, range })}
		<div class="my-4 flex items-center">
			<Pagination.PrevButton
				class={cn(
					'mr-2 inline-flex size-8 items-center justify-center rounded-md bg-transparent',
					'active:scale-[0.98] disabled:cursor-not-allowed hover:disabled:bg-transparent',
					'hover:bg-gray-500/30'
				)}
			>
				<CaretLeft class="size-4" />
			</Pagination.PrevButton>
			<div class="flex items-center gap-1">
				{#each pages as page (page.key)}
					{#if page.type === 'ellipsis'}
						<div class="text-foreground-alt text-sm font-medium select-none">...</div>
					{:else}
						<Pagination.Page
							{page}
							class={cn(
								'inline-flex size-8 items-center justify-center rounded-[9px] text-sm font-medium select-none',
								'hover:cursor-pointer hover:bg-gray-700/20',
								'data-selected:bg-gray-700/40',
								'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 hover:disabled:bg-transparent'
							)}
						>
							{page.value}
						</Pagination.Page>
					{/if}
				{/each}
			</div>
			<Pagination.NextButton
				class={cn(
					'ml-2 inline-flex size-8 items-center justify-center rounded-md bg-transparent',
					'active:scale-[0.98] disabled:cursor-not-allowed hover:disabled:bg-transparent',
					'hover:bg-gray-500/30'
				)}
			>
				<CaretRight class="size-4" />
			</Pagination.NextButton>
		</div>
	{/snippet}
</Pagination.Root>
