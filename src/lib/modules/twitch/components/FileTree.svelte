<script lang="ts">
	import { cn } from '$lib/utils';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import CursorText from 'phosphor-svelte/lib/CursorText';
	import Trash from 'phosphor-svelte/lib/Trash';
	import Check from 'phosphor-svelte/lib/Check';
	import type { FileEntry } from '../composables/useFileOperations.svelte';
	import FileTree from './FileTree.svelte';

	interface Props {
		entries: FileEntry[];
		basePath: string;
		onToggleDirectory: (path: string, file: FileEntry) => void;
		onRename: (path: string, file: FileEntry) => void;
		onDelete: (path: string, file: FileEntry) => void;
		onOpenFile: (path: string, fileName: string) => void;
		onCreateEntry: (entries: FileEntry[], isDirectory: boolean) => void;
		parent?: string | null;
	}

	let {
		entries,
		basePath,
		onToggleDirectory,
		onRename,
		onDelete,
		onOpenFile,
		onCreateEntry,
		parent = null
	}: Props = $props();

	const buildPath = (name: string): string => {
		return [basePath, parent, name].join('/').replace(/\/\//g, '/');
	};
</script>

{#snippet entryName(file: FileEntry, path: string, isDirectory: boolean)}
	{#if file.isEditing}
		<input
			type="text"
			class={cn('text-left', isDirectory ? 'col-span-1 max-w-[139px]' : 'col-span-2')}
			bind:this={file.input}
			bind:value={file.name}
		/>
	{:else if isDirectory}
		<button
			onclick={() => onToggleDirectory(path, file)}
			class="hover:bg-primary/5 col-span-1 truncate text-left"
		>
			{file.name}/
		</button>
	{:else}
		<button
			class="hover:bg-primary/5 col-span-2 truncate text-left"
			onclick={() => onOpenFile(path, file.name)}
		>
			{file.name}
		</button>
	{/if}
{/snippet}

{#snippet entryActions(file: FileEntry, path: string, isDirectory: boolean)}
	{#if isDirectory}
		<button class="hover:bg-primary/5">
			<CaretDown
				class={cn(file.children && 'rotate-180')}
				onclick={() => onToggleDirectory(path, file)}
			/>
		</button>
	{/if}
	<button
		onclick={() => onRename(path, file)}
		class={cn('hover:bg-primary/5', file.isEditing && '!bg-green-600 text-black')}
		title="Rename"
	>
		{#if file.isEditing}
			<Check />
		{:else}
			<CursorText />
		{/if}
	</button>
	<button onclick={() => onDelete(path, file)} class="hover:bg-red-500 hover:text-white">
		<Trash />
	</button>
{/snippet}

{#snippet createButtons(entries: FileEntry[])}
	<div class="col-span-4 mb-4 flex justify-end gap-[1px]">
		<button
			class="text-primary cursor-pointer !bg-transparent !px-3 !py-1 text-sm hover:opacity-80"
			onclick={() => onCreateEntry(entries, true)}
		>
			Add folder
		</button>
		<button
			class="text-primary cursor-pointer !bg-transparent !px-3 !py-1 text-sm hover:opacity-80"
			onclick={() => onCreateEntry(entries, false)}
		>
			Add file
		</button>
	</div>
{/snippet}

<ul class="col-span-4 flex w-full flex-col gap-[1px]">
	{#each entries as entry}
		{@const path = buildPath(entry.name)}

		<li
			class={cn(
				'grid grid-cols-[1fr_2rem_2rem_2rem] gap-[1px]',
				'[&_button]:bg-secondary-800 [&_button]:cursor-pointer [&_button]:p-2',
				parent && '[&_button]:bg-secondary-900',
				'[&_input]:bg-secondary-800 [&_input]:cursor-pointer [&_input]:p-2 [&_input]:outline-none',
				parent && '[&_input]:bg-secondary-900'
			)}
		>
			{@render entryName(entry, path, entry.isDirectory)}
			{@render entryActions(entry, path, entry.isDirectory)}

			{#if entry.isDirectory && entry.children}
				<FileTree
					entries={entry.children}
					{basePath}
					{onToggleDirectory}
					{onRename}
					{onDelete}
					{onOpenFile}
					{onCreateEntry}
					parent={entry.name}
				/>
				{@render createButtons(entry.children)}
			{/if}
		</li>
	{/each}
</ul>

{@render createButtons(entries)}
