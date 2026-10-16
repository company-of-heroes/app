<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { Skeleton } from '../ui/skeleton';

	type Props = {
		class?: string;
	};

	let { class: className }: Props = $props();
</script>

<!-- Mirrors ReplayCard: map art with chips and title, byline, rosters, counters + download. -->
<div class={cn('flex h-full min-w-0 flex-col bg-gray-950', className)} aria-busy="true">
	<div class="relative aspect-video">
		<Skeleton class="absolute inset-0 rounded-none opacity-40" />
		<div class="absolute inset-x-4 bottom-3 flex flex-col gap-1.5">
			<Skeleton class="h-4 w-32" />
			<Skeleton class="h-3 w-24" />
		</div>
	</div>
	<div class="mt-3 flex h-6 items-center gap-2 px-4">
		<Skeleton class="size-6 shrink-0 rounded-full" />
		<Skeleton class="h-3.5 w-32" />
	</div>
	<div class="border-secondary-800 divide-secondary-800 mt-3 flex flex-col divide-y border-t">
		{#each { length: 2 }, team (team)}
			<div class="flex flex-col py-1.5">
				<Skeleton class="mx-4 my-1 h-2.5 w-12" />
				{#each { length: 1 }, index (index)}
					<div class="flex h-6 items-center gap-2 px-4">
						<Skeleton class="size-5 shrink-0 rounded-full" />
						<Skeleton class="h-3 w-20" />
					</div>
				{/each}
			</div>
		{/each}
	</div>
	<div
		class="border-secondary-800 mt-auto flex items-center justify-between gap-3 border-t px-4 py-2"
	>
		<div class="flex items-center gap-3">
			<Skeleton class="h-4 w-8" />
			<Skeleton class="h-4 w-8" />
			<Skeleton class="h-4 w-8" />
		</div>
		<Skeleton class="size-8" />
	</div>
</div>
