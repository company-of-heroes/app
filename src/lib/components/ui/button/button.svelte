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
		'flex items-center gap-2 font-bold',
		'cursor-pointer px-8 py-2',
		'transition-all duration-100 hover:opacity-70',
		'disabled:cursor-not-allowed disabled:opacity-60',
		variant === 'primary' && 'bg-primary',
		variant === 'secondary' && 'bg-secondary-800 text-white',
		variant === 'destructive' && 'text-secondary-900 bg-red-400',
		restProps.class
	)}
	disabled={loading || restProps.disabled}
>
	{#if loading}
		<LoadingIcon size="20" class="animate-[spin_1500ms_linear_infinite]" />
	{/if}
	{@render children()}
</button>
