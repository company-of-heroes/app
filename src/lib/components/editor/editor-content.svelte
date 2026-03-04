<script lang="ts">
	import { EditorContent } from 'svelte-tiptap';
	import { useEditor } from './context.svelte';
	import { cn } from '$lib/utils';

	const editor = useEditor();
</script>

{#if editor.current}
	<EditorContent
		editor={editor.current}
		class={cn(
			'p-4 [&_.ProseMirror-focused]:outline-none',
			'[&_.is-editor-empty]:before:text-secondary-500 [&_.is-editor-empty]:before:content-[attr(data-placeholder)]',
			'[&_.is-editor-empty]:before:inset-0 [&_.is-editor-empty]:before:select-none',
			'[&_.is-editor-empty]:before:pointer-events-none [&_.is-editor-empty]:before:absolute',
			'**:data-[node="image"]:inline-flex! [&_.ProseMirror-selectednode]:outline-4 [&_.ProseMirror-selectednode]:outline-blue-500'
		)}
	/>
{/if}
