<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = HTMLAttributes<HTMLSpanElement>;

	let { children, ...restProps }: Props = $props();
</script>

<span
	{...restProps}
	class={cn('text-secondary-100 font-semibold whitespace-nowrap', restProps.class)}
>
	{@render children?.()}
</span>
