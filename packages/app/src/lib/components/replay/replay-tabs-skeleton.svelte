<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';

	type Props = {
		showTitle?: boolean;
	} & HTMLAttributes<HTMLDivElement>;

	let { showTitle = true, class: className, ...restProps }: Props = $props();
</script>

{#snippet playerCard()}
	<div
		class={cn(
			'border-secondary-800 grid grid-cols-[130px_auto] overflow-clip rounded-lg border',
			'bg-secondary-950/40'
		)}
	>
		<Skeleton class="aspect-square h-full w-full rounded-none" />
		<div class="flex flex-col gap-2 px-6 py-4">
			<Skeleton class="h-6 w-3/4" />
			<Skeleton class="h-4 w-1/2" />
			<Skeleton class="h-4 w-1/3" />
		</div>
	</div>
{/snippet}

<div {...restProps} class={cn('mt-8 flex flex-col gap-4', className)}>
	{#if showTitle}
		<Skeleton class="h-8 w-24" />
	{/if}

	<div class="mb-2 flex w-fit items-center gap-2">
		<Skeleton class="h-9 w-24" />
		<Skeleton class="h-9 w-16" />
		<Skeleton class="h-9 w-24" />
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div class="grid grid-cols-1 gap-2">
			{@render playerCard()}
			{@render playerCard()}
		</div>
		<div class="grid grid-cols-1 gap-2">
			{@render playerCard()}
			{@render playerCard()}
		</div>
	</div>
</div>
