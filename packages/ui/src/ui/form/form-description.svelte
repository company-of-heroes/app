<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = {
		children: Snippet;
	} & HTMLAttributes<HTMLElement>;

	let { children, ...restProps }: Props = $props();
</script>

<small {...restProps} class={cn('text-secondary-300 -mt-2', restProps.class)}>
	{@render children()}
</small>
