<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import ReplayTabsSkeleton from './replay-tabs-skeleton.svelte';
	import { cn } from '$lib/utils';

	type Props = {} & HTMLAttributes<HTMLDivElement>;

	let { class: className, ...restProps }: Props = $props();
</script>

<div {...restProps} class={cn('flex grow flex-col gap-4', className)}>
	<Skeleton class="mb-4 h-10 w-2/3" />

	<div class="mb-4 grid grid-cols-[300px_auto] gap-8">
		<Skeleton class="border-secondary-800 aspect-square rounded-lg border" />
		<div class="flex flex-col gap-4 py-4">
			<Skeleton class="h-8 w-1/2" />
			{#each Array(5) as _, i (i)}
				<div class="grid max-w-md grid-cols-2 gap-4">
					<Skeleton class="h-4 w-full" />
					<Skeleton class="h-4 w-full" />
				</div>
			{/each}
		</div>
	</div>

	<ReplayTabsSkeleton showTitle={false} class="mt-0" />
</div>
