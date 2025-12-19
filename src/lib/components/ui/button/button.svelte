<script lang="ts">
	import type { ButtonProps } from '.';
	import { cn } from '$lib/utils';
	import LoadingIcon from 'phosphor-svelte/lib/Spinner';

	let {
		children,
		variant = 'primary',
		loading = $bindable(false),
		...restProps
	}: ButtonProps = $props();
</script>

<button
	{...restProps}
	class={cn(
		'border border-transparent',
		'inline-flex h-11 items-center gap-2',
		'cursor-pointer rounded-md px-6',
		'transition-all duration-100 hover:opacity-70',
		'disabled:cursor-not-allowed disabled:opacity-60',
		variant === 'primary' && 'bg-primary/5 border-primary/20 text-white',
		variant === 'secondary' &&
			'border-secondary-800 bg-secondary-800/30 hover:border-secondary-600 hover:bg-secondary-700 text-white hover:opacity-100',
		variant === 'destructive' && 'text-destructive border-destructive/30 bg-destructive/5',
		variant === 'ghost' && 'active:bg-secondary-950/40 hover:opacity-100',
		variant === 'link' &&
			'text-primary hover:text-primary-600 bg-transparent font-medium hover:opacity-100',
		restProps.class
	)}
	disabled={loading || restProps.disabled}
>
	{#if loading}
		<LoadingIcon size="20" class="animate-[spin_1500ms_linear_infinite]" />
	{/if}
	{@render children()}
</button>
