<script lang="ts">
	import type { InputProps } from '.';
	import { cn } from '$lib/utils';
	import EyeIcon from 'phosphor-svelte/lib/Eye';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlash';
	import PlusIcon from 'phosphor-svelte/lib/Plus';
	import MinusIcon from 'phosphor-svelte/lib/Minus';

	let { value = $bindable(), type, ...restProps }: InputProps = $props();
	let originalType = type;
</script>

{#if type === 'number'}
	<div
		class={cn(
			'flex items-center rounded-md',
			'border-secondary-600 bg-secondary-800 focus:border-secondary-600 h-10 w-full border ps-4 pe-1.5 focus:outline-none',
			'peer-disabled:bg-secondary-950 peer-disabled:border-secondary-800 peer-disabled:cursor-not-allowed peer-disabled:text-gray-500',
			'peer-read-only:cursor-not-allowed peer-read-only:border-gray-600 peer-read-only:bg-gray-700 peer-read-only:text-gray-300',
			restProps.class
		)}
	>
		<input
			bind:value
			{...restProps}
			type="text"
			class="w-full outline-none"
			oninput={() => {
				value = value.replace(/[^0-9.-]/g, '');
			}}
		/>
		<button
			class="text-secondary-400 hover:bg-secondary-900 hover:text-secondary-200 peer cursor-pointer rounded-md p-1.5"
			type="button"
			onclick={() => {
				const step = restProps.step ? parseFloat(restProps.step.toString()) : 1;
				value = (parseFloat(value) + step).toString();

				if (restProps.max && parseFloat(value) > parseFloat(restProps.max.toString())) {
					value = restProps.max.toString();
				}
			}}
		>
			<PlusIcon />
		</button>
		<button
			class="text-secondary-400 hover:bg-secondary-900 hover:text-secondary-200 cursor-pointer rounded-md p-1.5"
			type="button"
			onclick={() => {
				const step = restProps.step ? parseFloat(restProps.step.toString()) : 1;
				value = (parseFloat(value) - step).toString();

				if (restProps.min && parseFloat(value) < parseFloat(restProps.min.toString())) {
					value = restProps.min.toString();
				}
			}}
		>
			<MinusIcon />
		</button>
	</div>
{:else}
	<div class="relative flex flex-1 items-center">
		<input
			bind:value
			{...restProps}
			{type}
			class={cn(
				'rounded-md',
				'border-secondary-600 bg-secondary-800 focus:border-secondary-600 h-10 w-full border px-4 focus:outline-none',
				'disabled:bg-secondary-950 disabled:border-secondary-800 disabled:cursor-not-allowed disabled:text-gray-500',
				'read-only:cursor-not-allowed read-only:border-gray-600 read-only:bg-gray-700 read-only:text-gray-300',
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
{/if}
