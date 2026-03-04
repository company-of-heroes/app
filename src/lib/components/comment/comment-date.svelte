<script lang="ts">
	import { useComment } from './context.svelte';
	import dayjs from '$lib/dayjs';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const comment = useComment();
</script>

<span {...restProps}>
	{dayjs(comment.current?.created).fromNow()}
</span>
