<script lang="ts">
	import { Skeleton } from '../ui/skeleton';

	type Props = {
		count?: number;
	};

	let { count = 2 }: Props = $props();
</script>

<!-- Mirrors TeamPlayerSkills: flat rank icon + position entries. -->
<div class="flex items-center gap-3">
	{#each { length: count }, index (index)}
		<span class="flex items-center gap-1.5">
			<Skeleton class="size-5 shrink-0 rounded-full" />
			<Skeleton class="h-3 w-8" />
		</span>
	{/each}
</div>
