<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import type { HTMLAttributes } from 'svelte/elements';
	import Badge from './badge.svelte';

	type Props = {
		label?: string;
	} & HTMLAttributes<HTMLSpanElement>;

	let { label = 'Live', class: className, ...restProps }: Props = $props();
</script>

<Badge
	variant="success"
	{...restProps}
	class={cn(
		'inline-flex items-center gap-1.5 font-semibold tracking-wide uppercase',
		className
	)}
>
	<span class="bg-success size-1.5 shrink-0 animate-pulse rounded-full" aria-hidden="true"></span>
	{label}
</Badge>
