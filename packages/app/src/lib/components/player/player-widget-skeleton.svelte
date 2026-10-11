<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { PlayerStatsTable } from '@company-of-heroes/ui/player';
	import { cn } from '$lib/utils';

	type Props = {
		expanded?: boolean;
		class?: string;
	};

	let { expanded = false, class: className }: Props = $props();
</script>

<div class={cn('border-secondary-900 overflow-clip border-b', className)}>
	<div class="border-secondary-800 border-b">
		<div class="flex flex-col gap-5 px-4 pt-6 pb-6 lg:flex-row lg:items-end lg:justify-between">
			<div class="flex min-w-0 items-end gap-4 sm:gap-5">
				<Skeleton class="size-20 shrink-0 rounded-md sm:size-28" />
				<div class="flex min-w-0 flex-col gap-2">
					<div class="flex items-center gap-2">
						<Skeleton class="h-4 w-6 rounded-xs" />
						<Skeleton class="h-5 w-14 rounded-md" />
					</div>
					<Skeleton class="h-9 w-56 max-w-full" />
				</div>
			</div>
			<div class="flex items-center gap-2">
				<Skeleton class="h-8 w-28 rounded-md" />
				<Skeleton class="h-8 w-32 rounded-md" />
			</div>
		</div>
	</div>
	<div class="overflow-hidden">
		<div class="-mr-px flex flex-wrap">
			{#each Array(8) as _, index (index)}
				<div
					class="border-secondary-800 flex min-w-40 flex-1 basis-44 flex-col gap-2 border-r border-b px-4 py-3"
				>
					<Skeleton class="h-3 w-16" />
					<Skeleton class="h-6 w-24" />
				</div>
			{/each}
		</div>
	</div>

	<div>
		<div class="flex items-center justify-between px-4 py-2.5">
			<div class="flex items-center gap-2">
				<Skeleton class="h-8 w-14 rounded-md" />
				<Skeleton class="h-8 w-24 rounded-md" />
				<Skeleton class="h-8 w-32 rounded-md" />
			</div>
			<Skeleton class="size-4 rounded-sm" />
		</div>
		{#if expanded}
			<div class="border-secondary-800 border-t">
				<PlayerStatsTable stats={[]} loading skeletonRows={12} />
			</div>
		{/if}
	</div>
</div>
