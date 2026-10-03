<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { Skeleton } from '../ui/skeleton';

	type Props = {
		class?: string;
	};

	let { class: className }: Props = $props();
</script>

<!-- Mirrors ReplayCard: map banner with labels, two team columns of players, counters + download. -->
<div class={cn('flex min-w-0 flex-col bg-gray-950', className)} aria-busy="true">
	<div class="relative aspect-video flex-1">
		<div class="absolute inset-x-4 bottom-3 flex flex-col gap-1.5">
			<Skeleton class="h-3 w-24" />
			<Skeleton class="h-5 w-40" />
			<Skeleton class="h-3 w-32" />
		</div>
	</div>
	<div class="divide-secondary-800 border-secondary-800 grid grid-cols-2 divide-x border-t">
		{#each { length: 2 }, team (team)}
			<div class="divide-secondary-800 flex flex-col divide-y">
				{#each { length: 2 }, index (index)}
					<div class="flex h-8 items-center gap-2 px-4">
						<Skeleton class="size-4 shrink-0 rounded-full" />
						<Skeleton class="h-3 w-20" />
					</div>
				{/each}
			</div>
		{/each}
	</div>
	<div class="border-secondary-800 flex items-center justify-between gap-3 border-t px-4 py-1.5">
		<div class="flex items-center gap-3">
			<Skeleton class="h-4 w-8" />
			<Skeleton class="h-4 w-8" />
			<Skeleton class="h-4 w-8" />
		</div>
		<Skeleton class="size-8" />
	</div>
</div>
