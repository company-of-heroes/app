<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';

	type Props = {} & HTMLButtonAttributes;

	let { children, ...restProps }: Props = $props();
</script>

<button
	onclick={() => history.back()}
	{...restProps}
	class={cn(
		'mb-6 inline-flex cursor-pointer items-center gap-2 text-xl transition-transform hover:-translate-x-0.5',
		restProps.class
	)}
>
	<ArrowLeft weight="duotone" />
	{#if children}
		{@render children()}
	{:else}
		Back to previous page
	{/if}
</button>
