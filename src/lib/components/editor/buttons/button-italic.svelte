<script>
	import { useEditor } from '../context.svelte';
	import Button from './button.svelte';
	import TextItalic from 'phosphor-svelte/lib/TextItalic';

	const editor = useEditor();
</script>

<Button
	onclick={() => {
		editor.current?.chain().focus().toggleItalic().run();
	}}
	data-active={editor.current?.isActive('italic')}
>
	<TextItalic />
</Button>
