<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import { flushHeader } from '@company-of-heroes/ui/variants';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';

	/** Same sections as `TournamentOverview`: in progress, upcoming, then the compact past grid. */
	const sections = [
		{ id: 'active', cards: 3, compact: false },
		{ id: 'upcoming', cards: 3, compact: false },
		{ id: 'past', cards: 4, compact: true }
	];
</script>

<div aria-busy="true">
	<header class="border-secondary-800 relative isolate shrink-0 overflow-hidden border-b">
		<div
			class="from-primary/15 pointer-events-none absolute inset-0 -z-10 bg-radial-[at_15%_0%] via-transparent to-transparent"
		></div>
		<TrophyIcon
			weight="duotone"
			class="text-primary/5 pointer-events-none absolute -top-6 right-4 -z-10 hidden size-56 sm:block"
		/>
		<div
			class="flex flex-col gap-6 px-4 pt-10 pb-6 sm:flex-row sm:items-end sm:justify-between sm:pt-14"
		>
			<div class="flex min-w-0 flex-col gap-2">
				<Skeleton class="h-4 w-20" />
				<Skeleton class="h-9 w-56 sm:h-10" />
				<Skeleton class="h-4 w-full max-w-xl" />
			</div>
			<Skeleton class="h-8 w-32 shrink-0" />
		</div>
	</header>

	{#each sections as section (section.id)}
		<div class={cn(flushHeader, 'flex items-center gap-2')}>
			<Skeleton class="h-4 w-28" />
		</div>
		<div class="border-secondary-800 shrink-0 overflow-hidden border-b">
			<ul
				class={cn(
					'-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2',
					section.compact ? 'lg:grid-cols-3 xl:grid-cols-4' : 'xl:grid-cols-3'
				)}
			>
				{#each { length: section.cards }, index (index)}
					<li class="border-secondary-800 flex min-w-0 flex-col border-r border-b bg-gray-950">
						<div class="flex min-h-40 flex-1 items-end px-4 pt-12 pb-4">
							<div class="flex min-w-0 flex-1 items-end gap-4">
								<Skeleton class="size-16 shrink-0 rounded-md" />
								<div class="flex min-w-0 flex-1 flex-col gap-1.5">
									<div class="flex items-center gap-2">
										<Skeleton class="h-5 w-20" />
										<Skeleton class="h-4 w-24" />
									</div>
									<Skeleton class="h-6 w-3/4" />
								</div>
							</div>
						</div>
						<div class="border-secondary-800 flex items-center gap-4 border-t px-4 py-2">
							<Skeleton class="h-5 w-24" />
							<Skeleton class="ms-auto h-5 w-20" />
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/each}
</div>
