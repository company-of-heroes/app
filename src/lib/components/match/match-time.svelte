<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useMatch } from '.';
	import { cn } from '$lib/utils';
	import dayjs from '$lib/dayjs';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const match = useMatch();
</script>

<span {...restProps} class={cn('inline-flex items-center gap-2', restProps.class)}>
	{dayjs(match.createdAt).format('[Today] [at], HH:mm')}
</span>
