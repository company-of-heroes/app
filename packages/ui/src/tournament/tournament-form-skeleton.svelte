<script lang="ts">
	import { Skeleton } from '@company-of-heroes/ui/skeleton';
	import { flushHeader } from '@company-of-heroes/ui/variants';

	/** The fields of `TournamentForm` in order; `tall` for the markdown editors. */
	const fields = [
		{ id: 'name', label: 'w-16', tall: false },
		{ id: 'format', label: 'w-20', tall: false },
		{ id: 'schedule', label: 'w-24', tall: false },
		{ id: 'stream', label: 'w-28', tall: false },
		{ id: 'images', label: 'w-20', tall: false },
		{ id: 'description', label: 'w-28', tall: true },
		{ id: 'rules', label: 'w-16', tall: true }
	];
</script>

<div aria-busy="true">
	<div class={flushHeader}>
		<Skeleton class="h-5 w-56" />
	</div>
	{#each fields as field (field.id)}
		<div class="border-secondary-800 border-b px-4 pt-3 pb-4">
			<Skeleton class="h-4 {field.label}" />
			{#if field.tall}
				<Skeleton class="mt-3 h-40 w-full" />
			{:else}
				<Skeleton class="mt-3 h-8 w-full max-w-xl" />
			{/if}
		</div>
	{/each}
	<div class="border-secondary-800 flex gap-3 border-b px-4 pt-3 pb-4">
		<Skeleton class="h-8 w-40" />
		<Skeleton class="h-8 w-28" />
	</div>
</div>
