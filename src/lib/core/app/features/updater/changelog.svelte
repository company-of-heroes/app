<script lang="ts">
	import { cn } from '$lib/utils';
	import ChangeLog from '../../../../../../CHANGELOG.md?raw';
	import { marked } from 'marked';
</script>

<div
	class={cn(
		'prose prose-headings:text-white prose-code:text-white prose-blockquote:text-white text-white',
		'prose-blockquote:border-secondary-700 prose-blockquote:text-primary'
	)}
>
	{@html marked(ChangeLog)}
</div>
