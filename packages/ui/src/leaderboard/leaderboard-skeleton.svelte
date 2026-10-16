<script lang="ts">
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import { tableHeadRow } from '@company-of-heroes/ui/variants';

	const podiumRanks = [2, 1, 3];
	const rows = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
</script>

<div aria-busy="true">
	<div
		class="border-secondary-800 sm:divide-secondary-800 grid grid-cols-1 border-b sm:grid-cols-3 sm:divide-x"
	>
		{#each podiumRanks as rank (rank)}
			<div
				class="flex min-w-0 flex-col items-center gap-3 px-4 {rank === 1
					? 'bg-primary/5 py-7 max-sm:order-first'
					: 'py-5 max-sm:hidden sm:pt-10'}"
			>
				<Skeleton class="rounded-xl {rank === 1 ? 'size-20' : 'size-16'}" />
				<Skeleton class="h-6 w-32" />
				<Skeleton class="h-4 w-24" />
				<Skeleton class="h-2 w-full max-w-60" />
			</div>
		{/each}
	</div>
	<div class="border-secondary-800 flex gap-3 border-b px-4 py-2.5">
		<Skeleton class="h-8 w-40" />
		<Skeleton class="h-8 w-40 max-sm:hidden" />
		<Skeleton class="h-8 w-36 max-sm:hidden" />
	</div>
	<div class="{tableHeadRow} h-9"></div>
	{#each rows as row (row)}
		<div class="border-secondary-800/70 flex min-h-12 items-center gap-3 border-b px-4 py-2">
			<Skeleton class="h-4 w-6" />
			<Skeleton class="h-4 w-6 max-md:hidden" />
			<Skeleton class="h-4 w-40 grow-0" />
			<div class="grow"></div>
			<Skeleton class="h-2 w-24 md:w-56" />
		</div>
	{/each}
</div>
