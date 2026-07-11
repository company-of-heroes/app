<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { goto } from '$app/navigation';
	import { cn } from '$lib/utils';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';

	type Props = {
		href?: string;
	} & HTMLButtonAttributes;

	let { href, children, onclick, class: className, ...restProps }: Props = $props();

	function handleClick(event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		if (onclick) {
			onclick(event);
			return;
		}
		if (href) {
			goto(href);
			return;
		}
		history.back();
	}
</script>

<button
	onclick={handleClick}
	{...restProps}
	class={cn(
		'mb-6 inline-flex cursor-pointer items-center gap-2 text-xl transition-transform hover:-translate-x-0.5',
		className
	)}
>
	<ArrowLeft weight="duotone" />
	{#if children}
		{@render children()}
	{:else}
		Back to previous page
	{/if}
</button>
