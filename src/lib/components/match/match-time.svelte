<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useMatch } from '.';
	import Clock from 'phosphor-svelte/lib/Clock';
	import { cn } from '$lib/utils';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const match = useMatch();
</script>

<span {...restProps} class={cn('inline-flex items-center gap-2', restProps.class)}>
	<Clock />
	{new Date(match.createdAt).toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit'
	})}
</span>
