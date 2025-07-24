<script lang="ts">
	import { editor } from 'monaco-editor';
	import { onMount } from 'svelte';
	import TwitchChatScript from '$lib/overlays/chat/script.js?raw';

	let editorContainer = $state<HTMLDivElement>();

	onMount(() => {
		if (!editorContainer) {
			return;
		}

		console.log(TwitchChatScript);

		editor.create(editorContainer, {
			value: TwitchChatScript,
			language: 'javascript',
			theme: 'vs-dark',
			minimap: {
				enabled: false
			}
		});
	});
</script>

<div bind:this={editorContainer} class="border-secondary-700 flex flex-1 flex-col border"></div>
