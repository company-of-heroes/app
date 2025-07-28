<script lang="ts">
	import { type editor as Monaco } from 'monaco-editor';
	import * as monaco from 'monaco-editor';
	import {
		exists,
		mkdir,
		readDir,
		readTextFile,
		writeFile,
		rename as rn,
		remove,
		type DirEntry,
		writeTextFile
	} from '@tauri-apps/plugin-fs';
	import { revealItemInDir } from '@tauri-apps/plugin-opener';
	import { app } from '$core/app';
	import { cn } from '$lib/utils';
	import { Editor } from '$lib/components/ui/input';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import CursorText from 'phosphor-svelte/lib/CursorText';
	import Trash from 'phosphor-svelte/lib/Trash';
	import Check from 'phosphor-svelte/lib/Check';
	import FolderOpen from 'phosphor-svelte/lib/FolderOpen';
	import X from 'phosphor-svelte/lib/X';
	import { appDataDir, join } from '@tauri-apps/api/path';
	import { resource, watch } from 'runed';

	type Entry = {
		children?: Entry[];
		isEditing?: boolean;
		input?: HTMLInputElement;
		oldName?: string;
	} & DirEntry;

	type Tab = {
		path: string;
		name: string;
		model: Monaco.ITextModel;
	};

	const twitch = app.getModule('twitch');
	let editor = $state<Monaco.IStandaloneCodeEditor>();
	let openTabs = $state<Tab[]>([]);
	let activeTabIndex = $state<number>(-1);

	let files = $state<DirEntry[]>();

	resource(
		() => twitch.overlays.overlay.path,
		async () => {
			files = await readDir(twitch.overlays.overlay.path, {
				baseDir: twitch.overlays.overlay.baseDir
			});
		}
	);

	const toggleDirectory = async (path: string, file: Entry) => {
		if (file.children) {
			file.children = undefined;
		} else {
			file.children = await readDir(path, { baseDir: twitch.overlays.overlay.baseDir });
			console.log(file.children);
		}
	};

	const rename = async (path: string, file: Entry) => {
		if (file.isEditing) {
			const paths = path.split('/');
			paths.pop();

			const oldPath = [...paths, file.oldName ?? file.name].join('/').replace(/\/\//g, '/');
			const newPath = [...paths, file.name].join('/').replace(/\/\//g, '/');

			if ((await exists(oldPath, { baseDir: twitch.overlays.overlay.baseDir })) === false) {
				if (file.isDirectory) {
					mkdir(oldPath, { baseDir: twitch.overlays.overlay.baseDir });
				}

				if (file.isFile) {
					await writeTextFile(oldPath, '', { baseDir: twitch.overlays.overlay.baseDir });
				}
			}

			if (oldPath !== newPath) {
				await rn(oldPath, newPath, {
					newPathBaseDir: twitch.overlays.overlay.baseDir,
					oldPathBaseDir: twitch.overlays.overlay.baseDir
				});
			}
			file.oldName = undefined;
		} else {
			file.oldName = file.name;
			setTimeout(() => file.input?.focus());
		}
		file.isEditing = !file.isEditing;
	};

	const openFile = async (path: string, fileName: string) => {
		// Check if tab is already open
		const existingTabIndex = openTabs.findIndex((tab) => tab.path === path);

		if (existingTabIndex !== -1) {
			// Switch to existing tab
			activeTabIndex = existingTabIndex;
			editor?.setModel(openTabs[existingTabIndex].model);
			return;
		}

		// Read file and create model
		const content = await readTextFile(path, { baseDir: twitch.overlays.overlay.baseDir });
		const uri = monaco.Uri.file(path);

		let model = monaco.editor.getModel(uri);

		if (!model) {
			model = monaco.editor.createModel(content, undefined, uri);
		} else {
			model.setValue(content);
		}

		// Add new tab
		openTabs.push({
			path,
			name: fileName,
			model
		});

		activeTabIndex = openTabs.length - 1;
		editor?.setModel(model);
	};

	const closeTab = (index: number) => {
		if (index < 0 || index >= openTabs.length) return;

		// Dispose the model
		openTabs[index].model.dispose();

		// Remove tab
		openTabs.splice(index, 1);

		// Adjust active tab index
		if (activeTabIndex >= index) {
			activeTabIndex = Math.max(0, activeTabIndex - 1);
		}

		// Set model for new active tab or clear editor
		if (openTabs.length > 0 && activeTabIndex < openTabs.length) {
			editor?.setModel(openTabs[activeTabIndex].model);
		} else {
			editor?.setModel(null);
			activeTabIndex = -1;
		}
	};

	const switchTab = (index: number) => {
		if (index < 0 || index >= openTabs.length) return;
		activeTabIndex = index;
		editor?.setModel(openTabs[index].model);
	};

	const deleteEntry = async (path: string, file: Entry) => {
		try {
			// Check if the file/folder actually exists on the filesystem
			const fileExists = await exists(path, { baseDir: twitch.overlays.overlay.baseDir });

			if (fileExists) {
				// Remove the file/folder from the filesystem
				await remove(path, {
					baseDir: twitch.overlays.overlay.baseDir,
					recursive: true // This allows deleting non-empty directories
				});

				// If it's a file that's currently open in a tab, close that tab
				if (file.isFile) {
					const tabIndex = openTabs.findIndex((tab) => tab.path === path);
					if (tabIndex !== -1) {
						closeTab(tabIndex);
					}
				}

				// If it's a directory, close all tabs for files within that directory
				if (file.isDirectory) {
					const tabsToClose = [];
					for (let i = openTabs.length - 1; i >= 0; i--) {
						if (openTabs[i].path.startsWith(path + '/')) {
							tabsToClose.push(i);
						}
					}
					// Close tabs in reverse order to maintain correct indices
					tabsToClose.forEach((index) => closeTab(index));
				}

				// Refresh the file tree by re-reading the directory
				files = await readDir(twitch.overlays.overlay.path, {
					baseDir: twitch.overlays.overlay.baseDir
				});
			} else {
				// File/folder doesn't exist on filesystem (likely a new entry being created)
				// Just refresh the file tree to remove it from the UI
				files = await readDir(twitch.overlays.overlay.path, {
					baseDir: twitch.overlays.overlay.baseDir
				});
			}
		} catch (error) {
			console.error('Failed to delete entry:', error);
			// Even if there's an error, refresh the file tree to ensure UI consistency
			try {
				files = await readDir(twitch.overlays.overlay.path, {
					baseDir: twitch.overlays.overlay.baseDir
				});
			} catch (refreshError) {
				console.error('Failed to refresh file tree:', refreshError);
			}
		}
	};
</script>

{#snippet entryName(file: Entry, path: string, isDirectory: boolean)}
	{#if file.isEditing}
		<input
			type="text"
			class={cn('text-left', isDirectory ? 'col-span-1 max-w-[139px]' : 'col-span-2')}
			bind:this={file.input}
			bind:value={file.name}
		/>
	{:else if isDirectory}
		<button
			onclick={() => toggleDirectory(path, file)}
			class="hover:bg-primary/5 col-span-1 truncate text-left"
		>
			{file.name}/
		</button>
	{:else}
		<button
			class="hover:bg-primary/5 col-span-2 truncate text-left"
			onclick={() => openFile(path, file.name)}
		>
			{file.name}
		</button>
	{/if}
{/snippet}

{#snippet entryActions(file: Entry, path: string, isDirectory: boolean)}
	{#if isDirectory}
		<button class="hover:bg-primary/5">
			<CaretDown
				class={cn(file.children && 'rotate-180')}
				onclick={() => toggleDirectory(path, file)}
			/>
		</button>
	{/if}
	<button
		onclick={() => rename(path, file)}
		class={cn('hover:bg-primary/5', file.isEditing && '!bg-green-600 text-black')}
		title="Rename"
	>
		{#if file.isEditing}
			<Check />
		{:else}
			<CursorText />
		{/if}
	</button>
	<button onclick={() => deleteEntry(path, file)} class="hover:bg-red-500 hover:text-white">
		<Trash />
	</button>
{/snippet}

{#snippet createFileAndFolderButton(entries: Entry[])}
	<div class="col-span-4 mb-4 flex justify-end gap-[1px]">
		<button
			class="text-primary cursor-pointer !bg-transparent !px-3 !py-1 text-sm hover:opacity-80"
			onclick={() => {
				let entry: Entry = $state({
					name: 'New Folder',
					isDirectory: true,
					isFile: false,
					isSymlink: false,
					children: undefined,
					isEditing: true,
					input: undefined,
					oldName: undefined
				});

				entries.push(entry);
				setTimeout(() => entry.input?.focus());
			}}
		>
			Add folder
		</button>
		<button
			class="text-primary cursor-pointer !bg-transparent !px-3 !py-1 text-sm hover:opacity-80"
			onclick={() => {
				let entry: Entry = $state({
					name: 'New File.txt',
					isDirectory: false,
					isFile: true,
					isSymlink: false,
					children: undefined,
					isEditing: true,
					input: undefined,
					oldName: undefined
				});

				entries.push(entry);
				setTimeout(() => entry.input?.focus());
			}}
		>
			Add file
		</button>
	</div>
{/snippet}

{#snippet renderEntries(parent: string | null, entries: Entry[])}
	<ul class="col-span-4 flex w-full flex-col gap-[1px]">
		{#each entries as entry}
			{@const path = [twitch.overlays.overlay.path, parent, entry.name]
				.join('/')
				.replace(/\/\//g, '/')}

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
					{@render renderEntries(entry.name, entry.children)}
					{@render createFileAndFolderButton(entry.children)}
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<nav class="mb-6 flex items-center gap-4">
	{#each twitch.overlays.overlays as overlay}
		<button
			class={cn(
				'text-secondary-500 hover:text-secondary-300 cursor-pointer font-bold',
				overlay.isActive && 'text-primary hover:text-primary hover:cursor-default'
			)}
			onclick={() => (twitch.overlays.overlay = overlay)}
		>
			{overlay.name}
		</button>
	{/each}
</nav>

{#if files}
	<div class="grid flex-grow grid-cols-[250px_1fr] overflow-hidden">
		<aside class="flex flex-col">
			{@render renderEntries(null, files)}
			{@render createFileAndFolderButton(files)}
			<button
				class="bg-secondary-900 hover:text-primary flex cursor-pointer items-center justify-center gap-2 py-1"
				onclick={async () => {
					revealItemInDir(
						await join(await appDataDir(), twitch.overlays.overlay.path, files![0].name)
					);
				}}
			>
				<FolderOpen />
				Open folder in explorer
			</button>
		</aside>
		<div class="flex flex-col">
			<div class="flex flex-grow flex-col">
				<!-- Tab bar -->
				{#if openTabs.length > 0}
					<div class="flex">
						{#each openTabs as tab, index}
							<div
								class={cn(
									'flex items-center gap-2',
									'hover:bg-secondary-800',
									index === activeTabIndex ? 'bg-secondary-700 text-primary' : 'bg-secondary-900'
								)}
							>
								<button
									class="max-w-[120px] flex-1 truncate ps-4 text-left"
									onclick={() => switchTab(index)}
								>
									{tab.name}
								</button>
								<button
									class="ml-2 flex h-8 w-8 items-center justify-center p-1 hover:bg-red-500 hover:text-white"
									onclick={(e) => {
										e.stopPropagation();
										closeTab(index);
									}}
								>
									<X size={12} />
								</button>
							</div>
						{/each}
					</div>
				{/if}
				<!-- Editor -->
				<Editor bind:editor />
			</div>
		</div>
	</div>
{/if}
