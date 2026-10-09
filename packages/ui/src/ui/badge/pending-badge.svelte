<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import Badge from './badge.svelte';

	type Props = {
		label?: string;
	} & HTMLAttributes<HTMLSpanElement>;

	let { label = 'Pending', class: className, ...restProps }: Props = $props();
</script>

<Badge variant="warning" pulse {...restProps} class={className}>
	{label}
</Badge>
