<script lang="ts">
	import { twitchOverlays } from '$core/app/plugins/twitch-overlays';
	import { cn } from '$lib/utils';
	import CopyIcon from 'phosphor-svelte/lib/Copy';
	import CheckIcon from 'phosphor-svelte/lib/Check';
	import { app } from '$core/app';

	let selectedOverlay = $state(twitchOverlays.overlays[0]);
	let copied = $state(false);

	function copyToClipboard() {
		navigator.clipboard.writeText(`http://localhost:9000/${selectedOverlay.path}/index.html`);
		copied = true;

		app.toast.success('Overlay URL copied to clipboard!');

		setTimeout(() => {
			copied = false;
		}, 5000);
	}
</script>

<div class="flex gap-4">
	{#each twitchOverlays.overlays as overlay}
		<button
			onclick={() => (selectedOverlay = overlay)}
			class={cn(
				'cursor-pointer py-2 font-semibold text-gray-600 transition-colors',
				'data-[active=false]:hover:text-primary/20',
				selectedOverlay.name === overlay.name && 'text-primary'
			)}
			data-active={selectedOverlay.name === overlay.name}
		>
			{overlay.name}
		</button>
	{/each}
</div>
<div class="mt-4 flex flex-col">
	<label for="overlay-url" class="font-medium text-neutral-400">Overlay URL</label>
	<small class="mb-2 text-gray-300">
		Use this URL in your streaming software to add the overlay to your stream.
	</small>
	<div class="relative flex">
		<input
			id="overlay-url"
			readonly
			value={`http://localhost:9000/${selectedOverlay.path}/index.html`}
			class="w-full rounded-md border border-neutral-700 bg-gray-700 px-4 py-2 shadow-2xs outline-none"
		/>
		<button
			class={cn(
				'absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-md p-1 text-gray-400 transition-colors',
				'hover:bg-gray-600 hover:text-gray-200',
				copied && 'pointer-events-none text-green-400'
			)}
			onclick={copyToClipboard}
			title="Copy Overlay URL"
		>
			{#if copied}
				<CheckIcon size={20} />
			{:else}
				<CopyIcon size={20} />
			{/if}
		</button>
	</div>
</div>
