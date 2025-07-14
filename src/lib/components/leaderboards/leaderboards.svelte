<script lang="ts">
	import { cn } from '$lib/utils';
</script>

<div class={cn('flex flex-grow flex-col gap-1')}>
	<div
		class={cn(
			'flex items-center gap-1',
			'[&>span]:bg-secondary-800 [&>span]:flex [&>span]:h-10 [&>span]:items-center [&>span]:px-4'
		)}
	>
		<span>#</span>
		<span class="flex-grow">Player</span>
		<span class="flex w-28 justify-center">Wins</span>
		<span class="flex w-28 justify-center">Losses</span>
		<span class="flex w-28 justify-center">Streak</span>
		<span class="flex w-28 justify-center">Ratio</span>
	</div>
</div>
