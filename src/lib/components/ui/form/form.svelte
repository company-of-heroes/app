<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLFormAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	type Props = {
		children?: Snippet;
	} & HTMLFormAttributes;

	let { children, ...restProps }: Props = $props();
</script>

<form {...restProps} class={cn('space-y-4', restProps.class)}>
	{@render children?.()}
</form>
