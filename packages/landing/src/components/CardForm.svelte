<script lang="ts">
	import { cn, interactive } from '$lib/cn';
	import { isSteamId, navigate } from '$lib/router.svelte';

	type Props = {
		initialSteamId?: string;
	};

	let { initialSteamId = '' }: Props = $props();

	let steamId = $state('');
	let validationError = $state<string | null>(null);

	$effect(() => {
		steamId = initialSteamId;
	});

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = steamId.trim();

		if (!isSteamId(trimmed)) {
			validationError = 'Enter a valid 17-digit Steam ID64 starting with 7656119.';
			return;
		}

		validationError = null;
		navigate(`/card/${trimmed}`);
	}
</script>

<form
	class="mx-auto flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
	onsubmit={handleSubmit}
>
	<div class="min-w-0 flex-1">
		<label for="steam-id" class="text-secondary-300 mb-2 block text-sm font-medium">
			Steam ID64
		</label>
		<input
			id="steam-id"
			type="text"
			inputmode="numeric"
			autocomplete="off"
			placeholder="76561198000000000"
			bind:value={steamId}
			class={cn(
				'border-secondary-700 bg-secondary-900/60 placeholder:text-secondary-600 w-full rounded-lg border px-4 py-2.5 text-white outline-none',
				'focus:border-primary/50 focus:ring-primary/20 focus:ring-2'
			)}
		/>
		{#if validationError}
			<p class="text-red-400 mt-2 text-sm">{validationError}</p>
		{/if}
	</div>
	<button
		type="submit"
		class={cn(
			interactive,
			'border-primary/30 bg-primary/10 text-primary-100 hover:bg-primary/20 hover:border-primary/50 shrink-0 rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors'
		)}
	>
		Show card
	</button>
</form>
