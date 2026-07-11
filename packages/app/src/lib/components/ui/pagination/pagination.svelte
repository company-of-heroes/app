<script lang="ts">
	import { cn } from '$lib/utils';
	import { Pagination, type PaginationRootProps } from 'bits-ui';
	import { watch } from 'runed';
	import CaretLeft from 'phosphor-svelte/lib/CaretLeft';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
	import { controlBase, interactive } from '../variants';

	let {
		page = $bindable<number>(),
		count,
		perPage = 1,
		...restProps
	}: PaginationRootProps = $props();

	let pageInput = $state('');
	let totalPages = $derived(Math.max(1, Math.ceil(count / perPage)));

	function commitPageInput() {
		const parsed = Number.parseInt(pageInput, 10);

		if (!Number.isFinite(parsed)) {
			pageInput = String(page);
			return;
		}

		const clamped = Math.min(Math.max(1, parsed), totalPages);
		page = clamped;
		pageInput = String(clamped);
	}

	function onPageInputKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			commitPageInput();
		}
	}

	watch(
		() => page,
		() => {
			pageInput = String(page);
		}
	);
</script>

<Pagination.Root {...restProps} {count} {perPage} bind:page>
	{#snippet children({ pages })}
		<div class="my-4 flex items-center gap-2">
			<Pagination.PrevButton
				class={cn(
					interactive,
					'inline-flex size-8 items-center justify-center rounded-md bg-transparent',
					'hover:bg-secondary-500/30'
				)}
			>
				<CaretLeft class="size-4" />
			</Pagination.PrevButton>
			<div class="flex items-center gap-1">
				{#each pages as pageItem (pageItem.key)}
					{#if pageItem.type === 'ellipsis'}
						<div class="text-foreground-alt text-sm font-medium select-none">...</div>
					{:else}
						<Pagination.Page
							page={pageItem}
							class={cn(
								interactive,
								'inline-flex size-9 items-center justify-center rounded-[9px] text-sm font-medium select-none',
								'border border-transparent',
								'hover:bg-secondary-700/20',
								'data-selected:border-secondary-800 data-selected:bg-secondary-700/30',
								'disabled:opacity-50 hover:disabled:bg-transparent'
							)}
						>
							{pageItem.value}
						</Pagination.Page>
					{/if}
				{/each}
			</div>
			<Pagination.NextButton
				class={cn(
					interactive,
					'inline-flex size-8 items-center justify-center rounded-md bg-transparent',
					'hover:bg-secondary-500/30'
				)}
			>
				<CaretRight class="size-4" />
			</Pagination.NextButton>
			<div class="text-secondary-400 ms-2 flex items-center gap-1.5 text-sm">
				<input
					type="text"
					inputmode="numeric"
					aria-label="Page number"
					bind:value={pageInput}
					onkeydown={onPageInputKeydown}
					onblur={commitPageInput}
					class={cn(controlBase, 'h-9 w-12 px-1 text-center text-sm')}
				/>
				<span>/ {totalPages}</span>
			</div>
		</div>
	{/snippet}
</Pagination.Root>
