<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '@company-of-heroes/ui/cn';
	import { flushHeader, flushSectionTitle } from '@company-of-heroes/ui/variants';

	type Props = {
		title: string;
		children: Snippet;
		class?: string;
	};

	let { title, children, class: className }: Props = $props();
</script>

<section class={cn('border-secondary-800 border-b', className)}>
	<h2 class={cn(flushHeader, flushSectionTitle)}>{title}</h2>
	<div class="p-4">
		{@render children()}
	</div>
</section>
