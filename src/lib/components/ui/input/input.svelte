<script lang="ts">
	import type { InputProps } from '.';
	import { cn } from '$lib/utils';
	import EyeIcon from 'phosphor-svelte/lib/Eye';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlash';

	let { value = $bindable(), type, ...restProps }: InputProps = $props();
	let originalType = type;
</script>

<div class="relative flex flex-1 items-center">
	<input
		bind:value
		{...restProps}
		{type}
		class={cn(
			'border-secondary-700 bg-secondary-900 focus:border-secondary-600 h-10 w-full border-2 px-4 focus:outline-none',
			'disabled:bg-secondary-950 disabled:border-secondary-800 disabled:cursor-not-allowed disabled:text-gray-500',
			restProps.class
		)}
	/>
	{#if originalType === 'password'}
		<button
			class="text-secondary-400 hover:bg-secondary-800 hover:text-secondary-200 absolute right-2 cursor-pointer rounded-md p-1.5"
			type="button"
			onclick={() => (type = type === 'password' ? 'text' : 'password')}
		>
			{#if type === 'password'}
				<EyeSlashIcon />
			{:else}
				<EyeIcon />
			{/if}
		</button>
	{/if}
</div>
