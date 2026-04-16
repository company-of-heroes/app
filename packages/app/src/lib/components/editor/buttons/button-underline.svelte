<script>
	import { useEditor } from '../context.svelte';
	import Button from './button.svelte';
	import TextUnderline from 'phosphor-svelte/lib/TextUnderline';

	const editor = useEditor();
</script>

<Button
	onclick={() => {
		editor.current?.chain().focus().toggleUnderline().run();
	}}
	data-active={editor.current?.isActive('underline')}
>
	<TextUnderline />
</Button>
