<script lang="ts">
	import { app } from '$lib/state/app.svelte';
	import { cn } from '$lib/utils';

	console.log(app.game.lobby);
</script>

<div class="flex items-start gap-6">
	<div class="border-secondary-700 flex items-center gap-2 rounded-md border px-4 py-2">
		<span>Status:</span>
		<span class={cn('font-bold', app.game.isRunning ? 'text-green-600' : 'text-red-600')}>
			{app.game.isRunning ? 'online' : 'offline'}
		</span>
	</div>
	<div class="border-secondary-700 flex items-center gap-2 rounded-md border px-4 py-2">
		<span>Game:</span>
		<span class={cn('font-bold', app.game.lobby ? 'text-green-600' : 'text-primary')}>
			{app.game.lobby ? 'ingame' : 'looking for a game'}
		</span>
	</div>
</div>
