<script lang="ts">
	import type { Readable } from 'svelte/store';
	import { onMount, type Snippet } from 'svelte';
	import { createEditor, EditorContext } from './context.svelte';
	import { createEditor as createTipTapEditor, Editor } from 'svelte-tiptap';
	import { Placeholder } from '@tiptap/extensions';
	import { Markdown } from '@tiptap/markdown';
	import { Image } from '@tiptap/extension-image';
	import StarterKit from '@tiptap/starter-kit';

	type Props = {
		children: Snippet;
		placeholder?: string;
		editor: EditorContext;
	};

	let { children, placeholder, editor = $bindable(createEditor()) }: Props = $props();
	let tiptap = $state<Readable<Editor>>();

	onMount(() => {
		tiptap = createTipTapEditor({
			extensions: [
				StarterKit,
				Markdown,
				Placeholder.configure({ placeholder: placeholder || 'Start typing...' }),
				Image.configure({
					resize: {
						enabled: true,
						alwaysPreserveAspectRatio: true
					}
				})
			],
			contentType: 'markdown',
			onUpdate: () => {
				editor.current?.commands.setContent(editor.current?.getMarkdown() || '', {
					emitUpdate: false,
					parseOptions: {
						preserveWhitespace: true
					}
				});
				console.log(editor?.current?.getMarkdown());
			}
		});

		return tiptap.subscribe((value) => {
			editor.current = value;
		});
	});
</script>

{@render children()}
