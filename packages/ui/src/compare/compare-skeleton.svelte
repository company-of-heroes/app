<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { tableHeadRow } from '@company-of-heroes/ui/variants';
	import { Skeleton } from '../ui/skeleton';
	import { mirroredRow } from './format';

	type Part = 'header' | 'accounts' | 'headToHead' | 'table' | 'factions' | 'maps';

	type Props = {
		/** The panel this stands in for; left out, the whole page (header, head to head, table, factions). */
		part?: Part;
		rows?: number;
		class?: string;
	};

	let { part, rows, class: className }: Props = $props();

	const parts = $derived<Part[]>(part ? [part] : ['header', 'headToHead', 'table', 'factions']);
	const defaultRows: Record<Part, number> = {
		header: 0,
		accounts: 0,
		headToHead: 3,
		table: 4,
		factions: 4,
		maps: 4
	};
</script>

{#snippet mirrored(count: number)}
	<div class={cn(tableHeadRow, mirroredRow, 'py-2')}>
		<Skeleton class="mx-auto h-3 w-12" />
		<Skeleton class="mx-auto h-3 w-20" />
		<Skeleton class="mx-auto h-3 w-16" />
	</div>
	<div class="-mb-px">
		{#each Array.from({ length: count }, (_, index) => index) as item (item)}
			<div class={cn(mirroredRow, 'border-secondary-800 h-10 border-b')}>
				<Skeleton class="mx-auto h-3.5 w-20" />
				<Skeleton class="mx-auto h-3.5 w-24" />
				<Skeleton class="mx-auto h-3.5 w-20" />
			</div>
		{/each}
	</div>
{/snippet}

{#each parts as item (item)}
	{@const count = rows ?? defaultRows[item]}
	<section class={cn('border-secondary-800 border-b', className)} aria-hidden="true">
		{#if item === 'header'}
			<div class="flex items-center gap-4 px-4 py-4">
				<div class="flex flex-1 items-center gap-3">
					<Skeleton class="size-12 shrink-0 rounded-md" />
					<Skeleton class="h-5 w-24" />
				</div>
				<Skeleton class="h-3.5 w-6" />
				<div class="flex flex-1 items-center justify-end gap-3">
					<Skeleton class="h-5 w-28" />
					<Skeleton class="size-12 shrink-0 rounded-md" />
				</div>
			</div>
		{:else if item === 'accounts'}
			<div class="flex flex-wrap items-center gap-2 px-4 py-3">
				<Skeleton class="h-3 w-16" />
				<Skeleton class="h-8 w-28 rounded-md" />
				<Skeleton class="h-8 w-28 rounded-md" />
			</div>
		{:else if item === 'headToHead'}
			<div class="border-secondary-800 flex items-baseline gap-3 border-b px-4 py-3">
				<Skeleton class="h-5 w-40" />
				<Skeleton class="h-4 w-16" />
			</div>
			<div class="-mb-px">
				{#each Array.from({ length: count }, (_, index) => index) as row (row)}
					<div class="border-secondary-800 flex h-9 items-center gap-3 border-b px-4">
						<Skeleton class="h-3.5 w-32" />
						<Skeleton class="ml-auto h-3.5 w-24" />
					</div>
				{/each}
			</div>
		{:else}
			{@render mirrored(count)}
		{/if}
	</section>
{/each}
