<script lang="ts">
	import TrahsIcon from 'phosphor-svelte/lib/Trash';
	import { dialog } from '$lib/components/ui/dialog/dialog.svelte';
	import { Label } from '../label';
	import Input from './input.svelte';
	import Button from '../button/button.svelte';

	type OptionsProps = {
		value: string[];
		selected?: string;
	};

	let { value = $bindable(), selected }: OptionsProps = $props();

	let isSubmitted = $state(false);
	let newOptionValue = $state<string>();
</script>

{#snippet dialogContent()}
	<div class="flex flex-col">
		<Label>New option</Label>
		<Input bind:value={newOptionValue} />
		{#if (isSubmitted && !newOptionValue) || newOptionValue === ''}
			<span class="mt-1 text-red-500">Enter a value</span>
		{/if}
	</div>
	<div class="mt-4 flex items-center justify-end">
		<Button
			variant="primary"
			onclick={() => {
				isSubmitted = true;

				if (!newOptionValue || newOptionValue === '') {
					return;
				}

				value.push(newOptionValue);
				dialog.close();
				isSubmitted = false;
			}}
		>
			Add
		</Button>
	</div>
{/snippet}

<div class="max-w-xs">
	<div class="flex flex-col items-start gap-0.5">
		{#each value as option}
			<span class="flex w-full items-center gap-0.5">
				<span class="bg-primary/5 flex-grow px-4 py-2">{option}</span>
				<button
					class="bg-secondary-800 hover:bg-secondary-900 cursor-pointer p-3"
					onclick={() => (value = value.filter((item) => item !== option))}
				>
					<TrahsIcon />
				</button>
			</span>
		{/each}
		<button
			class="bg-secondary-800 hover:bg-secondary-900 ms-auto cursor-pointer p-1 px-6"
			onclick={() => {
				dialog.open = true;
				dialog.component = dialogContent;
				dialog.title = 'Add Option';
				dialog.description = 'Add a new option to the list';
			}}
		>
			Add
		</button>
	</div>
</div>
