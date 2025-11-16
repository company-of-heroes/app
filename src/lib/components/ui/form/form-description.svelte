<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = {
		children: Snippet;
	} & HTMLAttributes<HTMLElement>;

	let { children, ...restProps }: Props = $props();
</script>

<small {...restProps} class="-mt-2 text-gray-400">{@render children()}</small>
