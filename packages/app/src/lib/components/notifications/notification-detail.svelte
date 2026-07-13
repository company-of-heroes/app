<script lang="ts">
	import { cn } from '$lib/utils';
	import { marked } from 'marked';

	type Props = {
		body: string;
	};

	let { body }: Props = $props();

	const html = $derived(marked.parse(body, { breaks: true }) as string);
</script>

<div
	class={cn(
		'prose prose-sm max-w-none text-secondary-200',
		'prose-headings:text-white prose-strong:text-white prose-code:text-white',
		'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
		'prose-blockquote:border-secondary-700 prose-blockquote:text-primary',
		'prose-li:marker:text-secondary-400'
	)}
>
	{@html html}
</div>
