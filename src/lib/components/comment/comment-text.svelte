<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useComment } from './context.svelte';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import { cn } from '$lib/utils';

	type Props = HTMLAttributes<HTMLDivElement>;

	const { ...restProps }: Props = $props();
	const comment = useComment();
</script>

<div {...restProps} class={cn('prose prose-invert max-w-full', restProps.class)}>
	{@html DOMPurify.sanitize(await marked.parse(comment.current?.text || ''))}
</div>
