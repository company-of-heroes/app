<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '@company-of-heroes/ui/cn';

	type Props = {
		children: Snippet;
		class?: string;
	};

	let { children, class: className }: Props = $props();
</script>

<!-- Every fact draws its own right and bottom line; the wrapper clips the last right line. -->
<div class={cn('overflow-hidden', className)}>
	<div class="-mr-px flex flex-wrap">
		{@render children()}
	</div>
</div>
