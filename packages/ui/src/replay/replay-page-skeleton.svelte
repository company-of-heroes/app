<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import ReplayTabsSkeleton from './replay-tabs-skeleton.svelte';
	import { cn } from '@company-of-heroes/ui/cn';

	type Props = {
		/** Website-style back + breadcrumb row. App uses layout breadcrumbs instead. */
		showNav?: boolean;
		overviewLabel?: string;
		chatLabel?: string;
		timelineLabel?: string;
		alliesLabel?: string;
		axisLabel?: string;
		ratingLabel?: string;
		cpmLabel?: string;
	} & HTMLAttributes<HTMLDivElement>;

	let {
		showNav = true,
		overviewLabel = 'Overview',
		chatLabel = 'Chat',
		timelineLabel = 'Timeline',
		alliesLabel = 'Allies',
		axisLabel = 'Axis',
		ratingLabel = 'Rating',
		cpmLabel = 'CPM',
		class: className,
		...restProps
	}: Props = $props();
</script>

<div
	{...restProps}
	class={cn('border-secondary-800 overflow-clip border-b', className)}
	aria-busy="true"
>
	{#if showNav}
		<div class="border-secondary-800 flex items-center gap-3 border-b px-4 py-3">
			<Skeleton class="size-9 shrink-0 rounded-md" />
			<Skeleton class="h-4 w-48" />
		</div>
	{/if}
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(220px,280px)_auto_minmax(0,1fr)]">
		<Skeleton class="aspect-square w-full self-start rounded-none" />
		<div class="flex items-start justify-center px-6 sm:px-0 sm:py-4">
			<div class="flex flex-col items-center gap-1">
				<Skeleton class="size-9 rounded-sm" />
				<Skeleton class="h-4 w-4" />
				<Skeleton class="size-9 rounded-sm" />
			</div>
		</div>
		<div class="min-w-0 px-6 py-4 sm:pl-0">
			<Skeleton class="mb-3 h-9 w-2/3" />
			<div
				class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr_auto_1fr] sm:gap-x-6"
			>
				{#each Array(8) as _, index (index)}
					<Skeleton class="h-4 w-20" />
					<Skeleton class="h-4 w-28" />
				{/each}
			</div>
			<div class="mt-4 flex flex-wrap items-center gap-3">
				<Skeleton class="h-9 w-40 rounded-md" />
				<Skeleton class="h-9 w-32 rounded-md" />
				<Skeleton class="h-4 w-10" />
			</div>
		</div>
	</div>

	<ReplayTabsSkeleton
		flush
		showTitle={false}
		{overviewLabel}
		{chatLabel}
		{timelineLabel}
		{alliesLabel}
		{axisLabel}
		{ratingLabel}
		{cpmLabel}
	/>
</div>
