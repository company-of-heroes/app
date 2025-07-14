<script lang="ts">
	import { app } from '$lib/state/app.svelte';
	import { onMount } from 'svelte';
	import CheckIcon from 'phosphor-svelte/lib/Check';
	import SpinnerIcon from 'phosphor-svelte/lib/Spinner';
	import { cn } from '$lib/utils';

	const twitch = app.getModule('twitch');
	let isEndingPrediction = $state(false);

	$effect(() => {
		console.log(twitch.predictions?.activePrediction);
	});

	onMount(() => {
		if (!twitch.client || !twitch.user || !twitch.user.userId) {
			console.error('Twitch client or user not found');
			return;
		}

		twitch.eventSub?.onChannelPredictionProgress(twitch.user.userId, (prediction) => {
			console.log(prediction);
		});
	});
</script>

{#if twitch?.predictions?.activePrediction}
	<div class="mt-8">
		<h3 class="mb-4 text-2xl font-bold">Active prediction</h3>
		<div class="flex gap-0.5">
			<span class="bg-secondary-800 text-secondary-400 w-42 truncate px-4 py-2 font-black">
				{twitch.predictions.activePrediction.title}
			</span>
			{#each twitch.predictions.activePrediction.outcomes as outcome}
				<span class="bg-primary flex w-44 text-black">
					<span class="px-4 py-2">{outcome.title}</span>
					<button
						class={cn(
							'bg-secondary-300 ms-auto cursor-pointer px-3 py-2 transition-colors duration-100 hover:bg-green-500 hover:text-white',
							'disabled:bg-secondary-600 disabled:text-secondary-200 disabled:cursor-not-allowed'
						)}
						title={`Set outcome to "${outcome.title}"`}
						onclick={() => {
							isEndingPrediction = true;
							twitch.predictions?.endPrediction(outcome.id).finally(() => {
								isEndingPrediction = false;
							});
						}}
						disabled={isEndingPrediction}
					>
						{#if isEndingPrediction}
							<SpinnerIcon class="animate-spin" />
						{:else}
							<CheckIcon />
						{/if}
					</button>
				</span>
			{/each}
		</div>
	</div>
{/if}
