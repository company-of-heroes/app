<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { controlBase, tabTrigger } from '@company-of-heroes/ui/variants';
	import { Pagination } from 'bits-ui';
	import CaretLeftIcon from 'phosphor-svelte/lib/CaretLeftIcon';
	import CaretRightIcon from 'phosphor-svelte/lib/CaretRightIcon';

	type Props = {
		page: number;
		count: number;
		perPage?: number;
		siblingCount?: number;
		onPage?: (page: number) => void;
		pageNumberLabel?: string;
		class?: string;
	};

	let {
		page = $bindable(),
		count,
		perPage = 1,
		siblingCount = 1,
		onPage,
		pageNumberLabel = 'Page number',
		class: className
	}: Props = $props();

	let focused = $state(false);
	let pageInput = $state('');
	const totalPages = $derived(Math.max(1, Math.ceil(count / perPage)));

	function handlePageChange(nextPage: number) {
		page = nextPage;
		onPage?.(nextPage);
	}

	function commitPageInput() {
		const parsed = Number.parseInt(pageInput, 10);
		focused = false;
		if (!Number.isFinite(parsed)) return;
		handlePageChange(Math.min(Math.max(1, parsed), totalPages));
	}
</script>

<Pagination.Root
	class={className}
	{count}
	{perPage}
	{siblingCount}
	{page}
	onPageChange={handlePageChange}
>
	{#snippet children({ pages }: any)}
		<div class="flex flex-wrap items-center gap-2">
			<Pagination.PrevButton
				class={cn(tabTrigger, 'inline-flex size-8 items-center justify-center px-0 py-0')}
			>
				<CaretLeftIcon class="size-4" />
			</Pagination.PrevButton>
			<div class="flex flex-wrap items-center gap-1">
				{#each pages as pageItem (pageItem.key)}
					{#if pageItem.type === 'ellipsis'}
						<div class="text-secondary-400 text-sm font-medium select-none">...</div>
					{:else}
						<Pagination.Page
							page={pageItem}
							class={cn(
								tabTrigger,
								'inline-flex size-9 items-center justify-center px-0 py-0 font-medium',
								'data-selected:border-primary/20 data-selected:bg-primary/5 data-selected:text-primary'
							)}
						>
							{pageItem.value}
						</Pagination.Page>
					{/if}
				{/each}
			</div>
			<Pagination.NextButton
				class={cn(tabTrigger, 'inline-flex size-8 items-center justify-center px-0 py-0')}
			>
				<CaretRightIcon class="size-4" />
			</Pagination.NextButton>
			<div class="text-secondary-400 ms-0 hidden items-center gap-1.5 text-sm sm:ms-2 sm:flex">
				<input
					type="text"
					inputmode="numeric"
					aria-label={pageNumberLabel}
					value={focused ? pageInput : String(page)}
					onfocus={() => {
						focused = true;
						pageInput = String(page);
					}}
					onkeydown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							commitPageInput();
						}
					}}
					oninput={(event) => (pageInput = event.currentTarget.value)}
					onblur={commitPageInput}
					class={cn(controlBase, 'h-9 w-12 rounded-none px-1 text-center text-sm')}
				/>
				<span>/ {totalPages}</span>
			</div>
		</div>
	{/snippet}
</Pagination.Root>
