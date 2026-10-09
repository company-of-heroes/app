<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { SemanticVariant } from '../../variants';

	type Props = {
		variant?: SemanticVariant | 'primary';
		hex?: string;
		/** Pulsing dot, for something happening right now (live, pending). */
		pulse?: boolean;
	} & HTMLAttributes<HTMLSpanElement>;

	let { variant = 'primary', hex, pulse = false, children, ...restProps }: Props = $props();
	const custom = $derived(hex ? /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex) : false);

	const DOTS: Record<SemanticVariant | 'primary', string | null> = {
		primary: 'bg-primary',
		default: null,
		destructive: 'bg-destructive',
		warning: 'bg-warning',
		success: 'bg-success',
		info: 'bg-info'
	};
	const dot = $derived(custom ? '' : DOTS[variant]);
</script>

<!-- One opaque grey surface for every badge, so it reads the same on a panel or an image; the
variant only colours the dot. Callers pass layout classes (position, shrink, truncate), never
colours, padding, size or radius, so every badge on the site looks the same. -->
<span
	{...restProps}
	class={cn(
		'border-secondary-800 text-secondary-100 inline-flex w-fit items-center gap-1.5 rounded-md border bg-gray-950 px-2 py-0.5 text-xs font-medium',
		restProps.class
	)}
>
	{#if dot !== null}
		<span class="relative inline-flex size-1.5 shrink-0" aria-hidden="true">
			{#if pulse}
				<span
					class={cn('absolute inline-flex size-full animate-ping rounded-full opacity-75', dot)}
					style:background-color={custom ? hex : undefined}
				></span>
			{/if}
			<span
				class={cn('relative inline-flex size-1.5 rounded-full', dot)}
				style:background-color={custom ? hex : undefined}
			></span>
		</span>
	{/if}
	{@render children?.()}
</span>
