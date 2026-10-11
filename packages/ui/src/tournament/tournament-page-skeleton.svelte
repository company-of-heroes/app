<script lang="ts">
	import { Skeleton } from '@company-of-heroes/ui/skeleton';

	/** Matches per round of the bracket placeholder: quarter finals, semi finals, final. */
	const rounds = [4, 2, 1];
</script>

<div aria-busy="true">
	<header class="border-secondary-800 relative isolate shrink-0 overflow-hidden border-b">
		<div
			class="from-primary/10 pointer-events-none absolute inset-0 -z-10 bg-radial-[at_15%_0%] via-transparent to-transparent"
		></div>
		<Skeleton class="absolute top-4 left-4 h-8 w-36" />
		<div class="flex flex-col gap-6 px-4 pt-16 pb-6 lg:flex-row lg:items-end lg:justify-between">
			<div class="flex min-w-0 items-end gap-4 sm:gap-5">
				<Skeleton class="size-20 shrink-0 rounded-md sm:size-28" />
				<div class="flex min-w-0 flex-col gap-2">
					<div class="flex items-center gap-2">
						<Skeleton class="h-5 w-20" />
						<Skeleton class="h-4 w-20" />
					</div>
					<Skeleton class="h-9 w-64 max-w-full sm:h-10 sm:w-80" />
				</div>
			</div>
		</div>
	</header>

	<div class="shrink-0 overflow-hidden">
		<div class="-mr-px flex flex-wrap">
			{#each { length: 4 }, index (index)}
				<div
					class="border-secondary-800 flex min-w-40 flex-1 basis-44 flex-col gap-1 border-r border-b px-4 py-3"
				>
					<Skeleton class="h-4 w-20" />
					<Skeleton class="h-6 w-28" />
				</div>
			{/each}
		</div>
	</div>

	<div class="border-secondary-800 flex h-11 items-center gap-6 border-b px-4">
		{#each ['w-16', 'w-20', 'w-16', 'w-12'] as width, index (index)}
			<Skeleton class="h-4 {width}" />
		{/each}
	</div>

	<div class="border-secondary-800 overflow-hidden border-b">
		<div class="divide-secondary-800 flex w-max min-w-full divide-x">
			{#each rounds as count, round (round)}
				<div class="flex w-64 shrink-0 flex-col last:min-w-64 last:flex-1">
					<div class="border-secondary-800 border-b px-4 py-2">
						<Skeleton class="h-4 w-24" />
					</div>
					<div class="flex flex-1 flex-col justify-around gap-3 px-4 py-4">
						{#each { length: count }, index (index)}
							<Skeleton class="h-24 w-56" />
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
