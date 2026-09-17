<script lang="ts">
	import type { ButtonProps } from '.';
	import { cn } from '@company-of-heroes/ui/cn';
	import LoadingIcon from 'phosphor-svelte/lib/SpinnerIcon';

	let {
		children,
		variant = 'primary',
		size = 'md',
		loading = $bindable(false),
		href,
		download,
		target,
		rel,
		...restProps
	}: ButtonProps = $props();
</script>

<svelte:element
	this={href ? 'a' : 'button'}
	{...restProps}
	{href}
	{download}
	{target}
	{rel}
	class={cn(
		'inline-flex items-center gap-2 transition-colors duration-150',
		'cursor-pointer rounded-md px-6 font-medium',
		'disabled:cursor-not-allowed disabled:opacity-60',
		variant !== 'ghost' && variant !== 'link' && 'border border-transparent',
		size === 'sm' && 'h-8 px-3 text-sm',
		size === 'md' && 'h-9 px-6 text-base',
		size === 'lg' && 'h-14 px-8 text-lg',
		size === 'icon' && 'size-11 justify-center p-0',
		size === 'icon-sm' && 'size-8 justify-center p-0 text-sm',
		variant === 'primary' &&
			'bg-primary border-0 text-secondary-950 shadow-[inset_0_1px_0_0_oklch(1_0_0_/0.4)] hover:bg-primary/90',
		variant === 'secondary' &&
			'border-secondary-700 bg-secondary-950 hover:border-secondary-600 hover:bg-secondary-800 text-white',
		variant === 'destructive' && 'bg-destructive border-destructive text-destructive-foreground',
		variant === 'success' && 'bg-success border-success text-success-foreground',
		variant === 'warning' && 'bg-warning border-warning text-warning-foreground',
		variant === 'ghost' && 'active:bg-secondary-900 border-0',
		variant === 'link' && 'text-primary hover:text-primary-300 border-0 bg-transparent font-medium',
		restProps.class
	)}
	disabled={loading || restProps.disabled}
>
	{#if loading}
		<LoadingIcon size="20" class="animate-[spin_1500ms_linear_infinite]" />
	{/if}
	{#if !loading || (size !== 'icon' && size !== 'icon-sm')}
		{@render children()}
	{/if}
</svelte:element>
