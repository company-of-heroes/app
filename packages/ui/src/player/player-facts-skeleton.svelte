<script lang="ts">
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
</script>

<!-- Same cells and lines as `PlayerFacts` with `PlayerFact`s. -->
<div class="overflow-hidden" aria-busy="true">
	<div class="-mr-px flex flex-wrap">
		{#each Array(4) as _, index (index)}
			<div
				class="border-secondary-800 flex min-w-40 flex-1 basis-44 flex-col gap-2 border-r border-b px-4 py-3"
			>
				<Skeleton class="h-3 w-16" />
				<Skeleton class="h-6 w-24" />
			</div>
		{/each}
	</div>
</div>
