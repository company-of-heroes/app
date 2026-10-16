<script lang="ts">
	import { Skeleton } from '@company-of-heroes/ui/skeleton';

	type Props = {
		rowCount?: number;
		dateLabel?: string;
	};

	let { rowCount = 30 }: Props = $props();

	const rows = $derived(Array.from({ length: rowCount }, (_, i) => i + 1));
</script>

<!-- Mirrors MatchRow: summary, face-off of two rosters, meta column. -->
{#snippet team(mirrored: boolean)}
	<div class="flex min-w-0 flex-col gap-1.5 px-2.5 py-2 {mirrored ? 'items-end' : 'items-start'}">
		<Skeleton class="h-2.5 w-10" />
		{#each { length: 2 }, index (index)}
			<div class="flex h-6 items-center gap-2 {mirrored ? 'flex-row-reverse' : ''}">
				<Skeleton class="size-5 shrink-0 rounded-full" />
				<Skeleton class="h-3 w-24" />
			</div>
		{/each}
	</div>
{/snippet}

<div aria-busy="true" class="-mb-px">
	{#each rows as row (row)}
		<div
			class="border-secondary-800 grid border-b lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)_minmax(10rem,12rem)]"
		>
			<div class="flex items-center gap-3 px-4 pt-4 lg:py-4">
				<Skeleton class="size-16 shrink-0 rounded-md" />
				<div class="flex flex-col gap-2">
					<Skeleton class="h-4 w-36" />
					<Skeleton class="h-4 w-20" />
				</div>
			</div>
			<div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 px-2 py-3">
				{@render team(true)}
				<Skeleton class="h-3 w-5" />
				{@render team(false)}
			</div>
			<div
				class="flex items-center justify-between gap-3 px-4 py-2.5 lg:flex-col lg:items-end lg:justify-center lg:py-4"
			>
				<Skeleton class="h-3.5 w-16" />
				<Skeleton class="h-3.5 w-28" />
			</div>
		</div>
	{/each}
</div>
