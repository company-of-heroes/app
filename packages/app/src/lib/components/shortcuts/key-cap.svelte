<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLSpanElement> & {
		class?: string;
		children?: Snippet;
	};

	let { class: className, children, ...restProps }: Props = $props();
</script>

<span
	{...restProps}
	class={cn(
		'border-secondary-700 bg-secondary-900/70 text-secondary-100 inline-flex h-7 min-w-7 items-center justify-center rounded border px-2 font-mono text-[11px] font-semibold tracking-wide uppercase',
		className
	)}
>
	{@render children?.()}
</span>
