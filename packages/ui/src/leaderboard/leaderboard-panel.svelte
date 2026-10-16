<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '@company-of-heroes/ui/cn';
	import { flushHeaderTitle } from '@company-of-heroes/ui/variants';

	type Props = {
		title: string;
		/** Muted text on the right of the title (the compared period). */
		meta?: string;
		/** Controls under the title (tabs). */
		actions?: Snippet;
		class?: string;
		children: Snippet;
	};

	let { title, meta, actions, class: className, children }: Props = $props();
</script>

<section class={cn('border-secondary-800 border-b', className)}>
	<header class="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
		<h2 class={flushHeaderTitle}>{title}</h2>
		{#if meta}
			<span class="text-secondary-500 text-xs">{meta}</span>
		{/if}
	</header>
	{#if actions}
		<div class="px-4 pb-2">{@render actions()}</div>
	{/if}
	{@render children()}
</section>
