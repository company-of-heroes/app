<script lang="ts">
	import { Skeleton } from '../ui/skeleton';
	import { flushHeader } from '../variants';

	type Props = {
		/** Cards in the first section. */
		cardCount?: number;
	};

	let { cardCount = 12 }: Props = $props();
	const cards = $derived(Array.from({ length: cardCount }, (_, index) => index));
	const tabs = [10, 14, 20, 16, 24, 16];
</script>

<!-- Same layout as the catalog: header with tabs and search, then a section of reward cards. -->
<div aria-busy="true">
	<div class="border-secondary-800 border-b px-4 py-6">
		<Skeleton class="h-9 w-40" />
		<div class="mt-2 flex max-w-3xl flex-col gap-1.5">
			<Skeleton class="h-4 w-full" />
			<Skeleton class="h-4 w-2/3" />
		</div>
		<div class="mt-5 flex flex-wrap items-center justify-between gap-3">
			<div class="flex flex-wrap items-center gap-1.5">
				{#each tabs as width, index (index)}
					<Skeleton class="h-8 rounded-md" style="width: {width * 0.25 + 2}rem" />
				{/each}
			</div>
			<Skeleton class="h-8 w-full rounded-md sm:w-58" />
		</div>
	</div>
	<div class="{flushHeader} flex items-center justify-between gap-3">
		<Skeleton class="h-4 w-20" />
		<Skeleton class="h-3 w-16" />
	</div>
	<div class="-mb-px overflow-hidden">
		<ul class="-mr-px grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
			{#each cards as card (card)}
				<li class="border-secondary-800 flex min-w-0 flex-col gap-2 border-r border-b p-4">
					<div class="flex items-center gap-3">
						<Skeleton class="h-4 w-14 rounded-[1px]" />
						<Skeleton class="ml-auto h-3 w-10" />
					</div>
					<div class="flex flex-col">
						<Skeleton class="h-5 w-36" />
						<Skeleton class="mt-1 h-3 w-48" />
						<div class="mt-2 flex flex-wrap gap-1">
							{#each { length: card % 3 === 0 ? 1 : 5 }, level (level)}
								<Skeleton class="h-5 w-11 rounded-md" />
							{/each}
						</div>
					</div>
				</li>
			{/each}
		</ul>
	</div>
</div>
