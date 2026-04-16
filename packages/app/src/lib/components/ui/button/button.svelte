<script lang="ts">
	import type { ButtonProps } from '.';
	import { cn } from '$lib/utils';
	import LoadingIcon from 'phosphor-svelte/lib/Spinner';

	let {
		children,
		variant = 'primary',
		size = 'md',
		loading = $bindable(false),
		href,
		...restProps
	}: ButtonProps = $props();
</script>

<svelte:element
	this={href ? 'a' : 'button'}
	{...restProps}
	{href}
	class={cn(
		'border border-transparent transition-colors duration-150',
		'inline-flex items-center gap-2',
		'cursor-pointer rounded-md px-6',
		'disabled:cursor-not-allowed disabled:opacity-60',
		size === 'sm' && 'h-8 px-3 text-sm',
		size === 'md' && 'h-11 px-6 text-base',
		size === 'lg' && 'h-14 px-8 text-lg',
		size === 'icon' && 'size-11 justify-center p-0',
		size === 'icon-sm' && 'size-8 justify-center p-0 text-sm',
		variant === 'primary' &&
			'bg-primary/5 border-primary/20 hover:border-primary/80 hover:bg-primary/20 text-white',
		variant === 'secondary' &&
			'border-secondary-800 bg-secondary-800/30 hover:border-secondary-500 hover:bg-secondary-800/80 text-white hover:opacity-100',
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
</svelte:element>
