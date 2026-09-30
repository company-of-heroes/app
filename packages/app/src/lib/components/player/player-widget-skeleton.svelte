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
		<div class="flex items-center gap-3 px-4 py-3">
			<Skeleton class="size-10 shrink-0 rounded-full" />
			<div class="flex min-w-0 flex-1 items-center gap-2">
				<Skeleton class="h-6 max-w-52 flex-1" />
				<Skeleton class="h-5 w-16 shrink-0 rounded-md" />
				<Skeleton class="ml-auto h-5 w-20 shrink-0 rounded-md" />
			</div>
		</div>
		<div class="border-secondary-800 grid grid-cols-6 border-t">
			{#each Array(6) as _, index (index)}
				<div
					class={cn(
						'border-secondary-800 flex flex-col items-center gap-1.5 px-2 py-3',
						index < 5 && 'border-r'
					)}
				>
					<Skeleton class="h-3 w-10" />
					<Skeleton class="h-5 w-12" />
				</div>
			{/each}
		</div>
		<div
			class="border-secondary-800 divide-secondary-800 grid grid-cols-10 divide-x overflow-clip border-t"
		>
			{#each Array(10) as _, index (index)}
				<Skeleton class="h-8 rounded-none" />
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
