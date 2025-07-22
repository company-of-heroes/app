<script lang="ts">
	import TrahsIcon from 'phosphor-svelte/lib/Trash';
	import EditIcon from 'phosphor-svelte/lib/PencilSimple';
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRight';
	import { dialog } from '$lib/components/ui/dialog/dialog.svelte';
	import { Label } from '../label';
	import Input from './input.svelte';
	import Button from '../button/button.svelte';
	import { findKey, isArray } from 'lodash-es';

	type OptionsProps = {
		value:
			| string[]
			| {
					[key: string]: string;
			  };
		selected?: string;
	};

	let { value = $bindable(), selected }: OptionsProps = $props();

	let isSubmitted = $state(false);
	let newOptionKey = $state<string>();
	let newOptionValue = $state<string>();

	dialog.on('close', () => {
		isSubmitted = false;
		newOptionKey = '';
		newOptionValue = '';
	});
</script>

{#snippet dialogContent()}
	<div class="flex flex-col gap-2">
		{#if isArray(value)}
			<Label>New option</Label>
			<Input bind:value={newOptionValue} />
			{#if (isSubmitted && !newOptionValue) || newOptionValue === ''}
				<span class="mt-1 text-red-500">Enter a value</span>
			{/if}
		{:else}
			<Label>New option</Label>
			<div class="grid grid-cols-[1fr_1em_1fr] items-center gap-2">
				<Input bind:value={newOptionKey} />
				<ArrowRightIcon weight="bold" class="text-secondary-500" />
				<Input bind:value={newOptionValue} />
			</div>
			{#if (isSubmitted && !newOptionValue) || newOptionValue === ''}
				<span class="mt-1 text-red-500">Enter a value</span>
			{/if}
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

				if (isArray(value)) {
					value.push(newOptionValue);
				} else {
					if (newOptionKey) {
						value = { ...value, [newOptionKey]: newOptionValue };
					}
				}

				dialog.close();
				isSubmitted = false;
			}}
		>
			Save
		</Button>
	</div>
{/snippet}

<div class="max-w-md">
	<div class="flex flex-col items-start gap-[2px]">
		{#if isArray(value)}
			{#each value as option}
				<span class="flex w-full items-center gap-[2px]">
					<span class="bg-primary/5 flex-grow px-4 py-2">{option}</span>
					<button
						class="bg-secondary-800 hover:bg-secondary-900 cursor-pointer p-3"
						onclick={() => (value = (value as string[]).filter((item) => item !== option))}
					>
						<TrahsIcon />
					</button>
				</span>
			{/each}
		{:else}
			{#each Object.entries(value) as [key, option]}
				<span class="grid w-full grid-cols-[1fr_1fr_2.5rem_2.5rem] items-center gap-[2px]">
					<span class="bg-primary/5 flex-grow truncate px-4 py-2">{key}</span>
					<span class="bg-primary/5 flex-grow truncate px-4 py-2">{option}</span>
					<button
						class="bg-secondary-800 hover:bg-secondary-900 cursor-pointer p-3"
						onclick={() => {
							value = Object.fromEntries(Object.entries(value).filter(([k]) => k !== key));
						}}
					>
						<TrahsIcon />
					</button>
					<button
						class="bg-secondary-800 hover:bg-secondary-900 cursor-pointer p-3"
						onclick={() => {
							dialog.open = true;
							dialog.component = dialogContent;
							dialog.title = 'Edit Option';
							dialog.description = 'Edit the selected option';

							newOptionKey = key;
							newOptionValue = option;
						}}
					>
						<EditIcon />
					</button>
				</span>
			{/each}
		{/if}
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
