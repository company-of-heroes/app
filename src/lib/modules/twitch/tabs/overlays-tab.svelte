<script lang="ts">
	import type { editor as Monaco } from 'monaco-editor';
	import * as Tabs from '$lib/components/ui/tabs';
	import { open } from '@tauri-apps/plugin-dialog';
	import { onMount } from 'svelte';
	import { app } from '$core/app';
	import { cn } from '$lib/utils';
	import { Editor } from '$lib/components/ui/input';

	const twitch = app.getModule('twitch');
	let editor = $state<Monaco.IStandaloneCodeEditor>();
	$inspect(twitch.overlays.overlays);
</script>

<nav class="mb-6 flex items-center gap-4">
	{#each twitch.overlays.overlays as overlay}
		<button
			class={cn(
				'text-secondary-500 hover:text-secondary-300 cursor-pointer font-bold',
				overlay.isActive && 'text-primary hover:text-primary hover:cursor-default'
			)}
			onclick={() => twitch.overlays.load(overlay)}
		>
			{overlay.name}
		</button>
	{/each}
</nav>
<div class="grid h-full grid-cols-[250px_1fr]">
	<aside class="flex flex-col">
		{#each twitch.overlays.overlay.files as file}
			<button
				class={cn(
					'hover:bg-secondary-900 flex cursor-pointer items-center gap-2 px-4 py-1 text-start',
					file.fileName === twitch.overlays.overlay.file.fileName &&
						'bg-secondary-800 text-primary/70 hover:bg-secondary-800 hover:cursor-default'
				)}
				onclick={() => {
					twitch.overlays.overlay.selectFile(file);
					editor?.setValue(file.content || '');
				}}
			>
				{#if file.icon}
					{@html file.icon}
				{/if}
				{file.fileName}
			</button>
		{/each}
	</aside>
	<div>
		<Editor
			bind:value={twitch.overlays.overlay.file.content}
			bind:editor
			bind:language={twitch.overlays.overlay.file.language}
		/>
	</div>
</div>
