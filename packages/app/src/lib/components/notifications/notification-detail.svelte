<script lang="ts">
	import { cn } from '$lib/utils';
	import { renderMarkdown } from '$lib/utils/markdown';

	type Props = {
		body: string;
	};

	let { body }: Props = $props();

	// Sanitized: notification bodies are written by staff accounts, not trusted HTML.
	const html = $derived(renderMarkdown(body));
</script>

<div
	class={cn(
		'prose prose-sm text-secondary-200 max-w-none p-4',
		'prose-headings:text-white prose-strong:text-white prose-code:text-white',
		'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
		'prose-blockquote:border-secondary-700 prose-blockquote:text-primary',
		'prose-li:marker:text-secondary-400'
	)}
>
	{@html html}
</div>
