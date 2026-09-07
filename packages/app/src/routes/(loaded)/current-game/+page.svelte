<script lang="ts">
	import type { ReplayData } from '@fknoobs/replay-parser';
	import type { Snapshot } from './$types';
	import { dev } from '$app/environment';
	import { app } from '$core/app/context';
	import CurrentGameView from '$lib/components/widgets/current-game-view.svelte';
	import { CURRENT_GAME_TEST } from '$lib/dev';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let match = $derived(app.lobby ?? (dev ? CURRENT_GAME_TEST : null));
	let replay = $state<{
		file: File;
		replay: ReplayData;
	} | null>(null);

	$effect(() => {
		return app.on('lobby.saved', (savedMatch) => {
			goto(resolve('/(loaded)/history/[id]', { id: savedMatch.id }));
		});
	});

	$effect(() => {
		if (!dev && !match) {
			goto('/');
		}
	});

	export const snapshot: Snapshot = {
		capture() {
			return { replay };
		},
		restore(data) {
			replay = data.replay;
		}
	};
</script>

{#key match}
	{#if match}
		<CurrentGameView lobby={match} />
	{/if}
{/key}
