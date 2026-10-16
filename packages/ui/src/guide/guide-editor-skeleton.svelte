<script lang="ts">
	import { flushHeader } from '@company-of-heroes/ui/variants';
	import { Skeleton } from '../ui/skeleton';
</script>

{#snippet field(input: string, description = false)}
	<div class="px-4 pt-3 pb-4">
		<Skeleton class="h-4 w-20" />
		{#if description}
			<Skeleton class="mt-2 h-4 w-72 max-w-full" />
		{/if}
		<Skeleton class="mt-3 w-full rounded-md {input}" />
	</div>
{/snippet}

{#snippet box(rows: string[])}
	<div>
		<div class={flushHeader}>
			<Skeleton class="h-3 w-24" />
		</div>
		<div class="flex flex-col gap-3 px-4 py-3">
			{#each rows as row, index (index)}
				<Skeleton class={row} />
			{/each}
		</div>
	</div>
{/snippet}

<!-- `GuideEditor`: title, address, summary and text on the left; the boxes on the right. -->
<div
	class="divide-secondary-800 -mb-px grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:divide-x"
	aria-busy="true"
>
	<div class="[&>*]:border-secondary-800 min-w-0 [&>*]:border-b">
		{@render field('h-8')}
		{@render field('h-8', true)}
		{@render field('h-16', true)}
		{@render field('h-[34rem]')}
	</div>
	<aside class="[&>*]:border-secondary-800 min-w-0 [&>*]:border-b">
		{@render box(['h-8 w-full rounded-md', 'h-3 w-40', 'h-3 w-32', 'h-8 w-48 rounded-md'])}
		{@render box(['h-4 w-44', 'h-4 w-36', 'h-4 w-40', 'h-8 w-32 rounded-md'])}
		{@render box(['aspect-[1.91/1] w-full rounded-md'])}
		{@render box(['h-8 w-full rounded-md', 'h-16 w-full rounded-md'])}
		{@render box(['h-8 w-full rounded-md'])}
	</aside>
</div>
