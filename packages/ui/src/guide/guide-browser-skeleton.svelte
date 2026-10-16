<script lang="ts">
	import { flushHeader } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import { Skeleton } from '../ui/skeleton';

	type Props = {
		/** Which page is loading: the index, a category or a guide (same layout as `GuideBrowser`). */
		kind?: 'index' | 'category' | 'guide';
	};

	let { kind = 'index' }: Props = $props();
	const host = useHost();
</script>

{#snippet nav()}
	<!-- "All guides", then each top-level category with its subcategories and guides. -->
	<div class="border-l-2 border-transparent py-3 pl-4">
		<Skeleton class="h-4 w-20" />
	</div>
	{#each [3, 2] as rows, index (index)}
		<div class="border-secondary-800 border-t pb-3">
			<div class="flex items-center justify-between py-3 pr-4 pl-4">
				<Skeleton class="h-3 w-24" />
				<Skeleton class="h-3 w-4" />
			</div>
			<div class="flex flex-col gap-2 px-4">
				<Skeleton class="h-4 w-28" />
				<div class="border-secondary-800 ml-0 flex flex-col gap-2.5 border-l py-1 pl-3">
					{#each { length: rows } as _, row (row)}
						<Skeleton class="h-3.5 w-40 max-w-full" />
					{/each}
				</div>
			</div>
		</div>
	{/each}
{/snippet}

{#snippet breadcrumb()}
	{#if !host.breadcrumbs}
		<div class="flex items-center gap-3 px-4 py-3">
			<Skeleton class="size-9 shrink-0 rounded-md" />
			<Skeleton class="h-4 w-48" />
		</div>
	{/if}
{/snippet}

{#snippet list(count: number)}
	<!-- The card grid of `GuideList`: cover, title, excerpt, then author, date and reading time. -->
	<div class="overflow-hidden">
		<ul class="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
			{#each { length: count } as _, index (index)}
				<li class="border-secondary-800 flex min-w-0 flex-col border-r border-b bg-gray-950">
					<Skeleton class="aspect-[1.91/1] w-full rounded-none" />
					<div class="flex flex-1 flex-col gap-2 px-4 py-4">
						<Skeleton class="h-6 w-3/4" />
						<Skeleton class="h-4 w-full" />
						<Skeleton class="h-4 w-2/3" />
						<div class="flex items-center gap-3 pt-2">
							<Skeleton class="h-3 w-20" />
							<Skeleton class="h-3 w-16" />
							<Skeleton class="h-3 w-12" />
						</div>
					</div>
				</li>
			{/each}
		</ul>
	</div>
{/snippet}

<div
	class="divide-secondary-800 -mb-px grid flex-1 content-start lg:grid-cols-[18rem_minmax(0,1fr)] lg:content-stretch lg:divide-x"
	aria-busy="true"
>
	<aside class="[&>*]:border-secondary-800 min-w-0 [&>*]:border-b">
		<div class="flex items-center gap-2 px-4 py-3 lg:hidden">
			<Skeleton class="size-3.5 rounded-sm" />
			<Skeleton class="h-3 w-28" />
		</div>
		<div class="hidden lg:block">
			<div class={flushHeader}>
				<Skeleton class="h-3 w-16" />
			</div>
			{@render nav()}
		</div>
	</aside>
	<div class="[&>*]:border-secondary-800 min-w-0 [&>*]:border-b">
		{#if kind === 'guide'}
			{@render breadcrumb()}
			<!-- `GuideArticle`: header, cover, then the text. -->
			<div class="px-4 py-6 sm:px-6">
				<Skeleton class="h-9 w-4/5 max-w-2xl sm:h-10" />
				<div class="mt-3 flex max-w-3xl flex-col gap-2">
					<Skeleton class="h-5 w-full" />
					<Skeleton class="h-5 w-2/3" />
				</div>
				<div class="mt-4 flex flex-wrap items-center gap-4">
					<div class="flex items-center gap-2">
						<Skeleton class="size-6 rounded-full" />
						<Skeleton class="h-4 w-24" />
					</div>
					<Skeleton class="h-4 w-20" />
					<Skeleton class="h-4 w-16" />
				</div>
			</div>
			<Skeleton class="aspect-[1.91/1] w-full rounded-none" />
			<div class="px-4 py-6 sm:px-6">
				<div class="mx-auto flex max-w-3xl flex-col gap-3">
					{#each [100, 95, 98, 60] as width (width)}
						<Skeleton class="h-4" style="width: {width}%" />
					{/each}
					<Skeleton class="mt-4 h-7 w-1/2" />
					{#each [97, 92, 99, 75] as width (width)}
						<Skeleton class="h-4" style="width: {width}%" />
					{/each}
				</div>
			</div>
		{:else if kind === 'category'}
			{@render breadcrumb()}
			<div class="px-4 py-6 sm:px-6">
				<Skeleton class="h-9 w-56" />
				<Skeleton class="mt-2 h-4 w-20" />
				<div class="mt-4 flex flex-wrap gap-2">
					<Skeleton class="h-8 w-20 rounded-md" />
					<Skeleton class="h-8 w-24 rounded-md" />
				</div>
			</div>
			{@render list(6)}
		{:else}
			<div class="flex flex-wrap items-start justify-between gap-4 px-4 py-6 sm:px-6">
				<div class="flex min-w-0 flex-1 flex-col">
					<Skeleton class="h-9 w-36" />
					<Skeleton class="mt-2 h-4 w-full max-w-lg" />
				</div>
				<Skeleton class="h-8 w-28 rounded-md" />
			</div>
			{@render list(6)}
		{/if}
	</div>
</div>
