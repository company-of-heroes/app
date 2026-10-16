<script lang="ts">
	import { Skeleton } from '../ui/skeleton';
	import { accentBlock, flushHeader } from '../variants';

	type Props = {
		/** Building columns in the tech tree. */
		columnCount?: number;
	};

	let { columnCount = 6 }: Props = $props();
	const columns = $derived(Array.from({ length: columnCount }, (_, index) => index));
	const tabs = [28, 28, 28, 28, 18, 14, 18];
</script>

<!-- Same layout as DocsOverview: header with faction tabs and search, doctrines, tech tree. -->
<div aria-busy="true">
	<div class="border-secondary-800 border-b px-4 py-6">
		<div class="flex items-start justify-between gap-3">
			<Skeleton class="h-9 w-24" />
			<Skeleton class="h-8 w-28 shrink-0 rounded-md" />
		</div>
		<div class="mt-2 flex max-w-3xl flex-col gap-1.5">
			<Skeleton class="h-4 w-full" />
			<Skeleton class="h-4 w-1/2" />
		</div>
		<div class="mt-5 flex flex-wrap items-center justify-between gap-3">
			<div class="flex flex-wrap items-center gap-1.5">
				{#each tabs as width, index (index)}
					<Skeleton class="h-8 rounded-md" style="width: {width * 0.25}rem" />
				{/each}
			</div>
			<Skeleton class="h-8 w-full rounded-md sm:w-58" />
		</div>
	</div>
	<section class="border-secondary-800 border-b">
		<div class={flushHeader}>
			<Skeleton class="h-4 w-20" />
		</div>
		<div class="-mb-px overflow-hidden">
			<div class="-mr-px grid sm:grid-cols-3">
				{#each { length: 3 }, index (index)}
					<div class="border-secondary-800 flex items-center gap-4 border-r border-b px-4 py-6">
						<Skeleton class="size-14 shrink-0" />
						<div class="flex min-w-0 flex-1 flex-col gap-2">
							<Skeleton class="h-6 w-40" />
							<Skeleton class="h-4 w-16" />
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>
	<section class="border-secondary-800 border-b">
		<div class="{flushHeader} flex items-center justify-between gap-3">
			<Skeleton class="h-4 w-36" />
			<Skeleton class="h-3 w-16" />
		</div>
		<div class="-mb-px overflow-hidden">
			<div
				class="-mr-px grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(var(--columns),minmax(0,1fr))]"
				style:--columns={columnCount}
			>
				{#each columns as column (column)}
					<div class="border-secondary-800 min-w-0 border-r">
						<div class="border-secondary-800 flex items-center gap-3 border-b px-4 py-3">
							<Skeleton class="size-9 shrink-0" />
							<div class="flex min-w-0 flex-col gap-1.5">
								<Skeleton class="h-3 w-12" />
								<Skeleton class="h-4 w-24" />
							</div>
						</div>
						{#each { length: 3 + (column % 3) }, row (row)}
							<div class="border-secondary-800 flex items-center gap-3 border-b px-4 py-2">
								<Skeleton class="size-8 shrink-0" />
								<Skeleton class="h-4 w-28" />
							</div>
						{/each}
						<div class={accentBlock}>
							<div class="px-4 pt-2.5 pb-1.5">
								<Skeleton class="h-3 w-16" />
							</div>
							{#each { length: 2 }, row (row)}
								<div class="border-secondary-800 flex items-center gap-3 border-b px-4 py-1.5">
									<Skeleton class="size-7 shrink-0" />
									<Skeleton class="h-4 w-24" />
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>
	<div class="px-4 py-3">
		<Skeleton class="h-3 w-80 max-w-full" />
	</div>
</div>
