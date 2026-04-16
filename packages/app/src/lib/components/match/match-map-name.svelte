<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useMatch } from '.';
	import { cn, normalizeMapName } from '$lib/utils';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const match = useMatch();
</script>

<span {...restProps} class={cn('truncate', restProps.class)}>{normalizeMapName(match.map)}</span>
