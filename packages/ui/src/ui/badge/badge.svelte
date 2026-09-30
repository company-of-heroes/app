<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { SemanticVariant } from '../../variants';

	type Props = {
		variant?: SemanticVariant | 'primary';
		hex?: string;
	} & HTMLAttributes<HTMLSpanElement>;

	let { variant = 'primary', hex, children, ...restProps }: Props = $props();
	const custom = $derived(hex ? /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex) : false);
</script>

<span
	{...restProps}
	style:color={custom ? hex : undefined}
	style:border-color={custom ? `color-mix(in srgb, ${hex} 25%, transparent)` : undefined}
	style:background-color={custom ? `color-mix(in srgb, ${hex} 10%, transparent)` : undefined}
	class={cn(
		'inline-block w-fit rounded-md border px-2.5 py-0.5 text-xs font-medium',
		!custom && variant === 'primary' && 'border-primary/20 bg-primary/5 text-primary',
		!custom &&
			variant === 'default' &&
			'border-secondary-700 bg-secondary-800/30 text-secondary-300',
		!custom &&
			variant === 'destructive' &&
			'border-destructive/20 bg-destructive/5 text-destructive',
		!custom && variant === 'warning' && 'border-warning/20 bg-warning/5 text-warning',
		!custom && variant === 'success' && 'border-success/20 bg-success/5 text-success',
		!custom && variant === 'info' && 'border-info/20 bg-info/5 text-info',
		restProps.class
	)}
>
	{@render children?.()}
</span>
