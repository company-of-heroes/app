<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useMatch } from '.';
	import { cn } from '$lib/utils';
	import { app } from '$core/context';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const match = useMatch();
</script>

<span {...restProps}>
	{new Date(match.createdAt).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	})}
</span>
