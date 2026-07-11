<script lang="ts">
	import type { ReplayData } from '@fknoobs/replay-parser';
	import type { Snapshot } from './$types';
	import { dev } from '$app/environment';
	import { app } from '$core/app/context';
	import { ButtonBack } from '$lib/components/ui/button';
	import CurrentGameView from '$lib/components/widgets/current-game-view.svelte';
	import { CURRENT_GAME_TEST } from '$lib/dev';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let match = $derived(dev ? CURRENT_GAME_TEST : app.lobby);
	let replay = $state<{
		file: File;
		replay: ReplayData;
	} | null>(null);

	app.on('lobby.saved', (savedMatch) => {
		goto(resolve('/(loaded)/history/[id]', { id: savedMatch.id }));
	});

	$effect(() => {
		if (!dev && !match) {
			goto('/');
		}
	});

	export const snapshot: Snapshot = {
		capture() {
			return {
				match,
				replay
			};
		},
		restore(snapshot) {
			match = snapshot.match;
			replay = snapshot.replay;
		}
	};
</script>

<ButtonBack href="/">Back to Dashboard</ButtonBack>

{#key match}
	{#if match}
		<div class="mt-4">
			<CurrentGameView lobby={match} />
		</div>
	{/if}
{/key}
