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
		'inline-flex items-center gap-2',
		'cursor-pointer rounded-md px-6 py-2',
		'transition-all duration-100 hover:opacity-70',
		'disabled:cursor-not-allowed disabled:opacity-60',
		variant === 'primary' && 'bg-primary-300 text-black',
		variant === 'secondary' &&
			'border-gray-700 bg-gray-800 text-white hover:border-gray-600 hover:bg-gray-700 hover:opacity-100',
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
