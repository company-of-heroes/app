<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '@company-of-heroes/ui/cn';
	import { flushHeader, flushHeaderTitle } from '@company-of-heroes/ui/variants';

	type Props = {
		title: string;
		/** Small right-aligned text in the header (e.g. a count). */
		note?: string;
		/** Pad the body for plain text; rows, grids and tables bring their own `px-4`. */
		padded?: boolean;
		children: Snippet;
		class?: string;
	};

	let { title, note, padded = false, children, class: className }: Props = $props();
</script>

<section class={className}>
	<div class={cn(flushHeader, 'flex items-baseline justify-between gap-3')}>
		<h2 class={flushHeaderTitle}>{title}</h2>
		{#if note}
			<p class="text-secondary-500 text-xs">{note}</p>
		{/if}
	</div>
	<div class={cn(padded && 'px-4 py-3')}>
		{@render children()}
	</div>
</section>
