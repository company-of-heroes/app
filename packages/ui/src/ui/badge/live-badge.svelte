<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import Badge from './badge.svelte';

	type Props = {
		label?: string;
	} & HTMLAttributes<HTMLSpanElement>;

	let { label = 'Live', class: className, ...restProps }: Props = $props();
</script>

<Badge variant="success" pulse {...restProps} class={className}>
	{label}
</Badge>
