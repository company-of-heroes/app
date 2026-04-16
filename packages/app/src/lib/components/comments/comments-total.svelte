<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useComments } from './context.svelte';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const comments = useComments();
</script>

<span {...restProps}>{comments.totalItems}</span>
