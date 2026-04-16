<script lang="ts">
	import type { Overlay } from '$core/app/features/twitch-overlays/overlays/overlay.svelte';
	import { cn } from '$lib/utils';
	import FolderIcon from 'phosphor-svelte/lib/Folder';
	import FolderOpenIcon from 'phosphor-svelte/lib/FolderOpen';
	import FileIcon from 'phosphor-svelte/lib/File';
	import FileTree from './file-tree.svelte';

	interface FileEntry {
		name: string;
		isDirectory: boolean;
		isFile: boolean;
		isSymlink: boolean;
	}

	interface Props {
		overlay: Overlay;
		path?: string;
		depth?: number;
		expandedFolders?: Set<string>;
		onToggleFolder?: (path: string) => void;
		onFileClick?: (filePath: string, fileName: string) => void;
		activeFilePath?: string;
	}

	let {
		overlay,
		path = '',
		depth = 0,
		expandedFolders = $bindable(new Set()),
		onToggleFolder,
		onFileClick,
		activeFilePath
	}: Props = $props();

	let files = $state<FileEntry[]>([]);
	let loading = $state(true);

	async function loadFiles() {
		loading = true;
		try {
			files = await overlay.getFiles(path);
		} catch (error) {
			console.error('Error loading files:', error);
			files = [];
		} finally {
			loading = false;
		}
	}

	function toggleFolder(folderName: string) {
		const folderPath = path ? `${path}/${folderName}` : folderName;
		if (onToggleFolder) {
			onToggleFolder(folderPath);
		} else {
			if (expandedFolders.has(folderPath)) {
				expandedFolders.delete(folderPath);
			} else {
				expandedFolders.add(folderPath);
			}
			expandedFolders = new Set(expandedFolders); // Create new Set to trigger reactivity
		}
	}

	function isExpanded(folderName: string): boolean {
		const folderPath = path ? `${path}/${folderName}` : folderName;
		return expandedFolders.has(folderPath);
	}

	$effect(() => {
		loadFiles();
	});
</script>

{#if loading && depth === 0}
	<div class="py-4 text-sm text-gray-400">Loading files...</div>
{:else}
	<div class="flex flex-col">
		{#each files as file}
			{@const folderPath = path ? `${path}/${file.name}` : file.name}
			{@const expanded = isExpanded(file.name)}

			{#if file.isDirectory}
				<div>
					<button
						onclick={() => toggleFolder(file.name)}
						class={cn(
							'flex w-full items-center gap-2 rounded px-4 py-1 text-left',
							'cursor-pointer transition-colors',
							'hover:bg-gray-700'
						)}
						style="padding-left: {depth * 16 + 16}px"
					>
						{#if expanded}
							<FolderOpenIcon size={20} class="text-primary" />
						{:else}
							<FolderIcon size={20} class="text-primary" />
						{/if}
						<span class="text-gray-200">{file.name}</span>
					</button>

					{#if expanded}
						<FileTree
							{overlay}
							path={folderPath}
							depth={depth + 1}
							bind:expandedFolders
							{onToggleFolder}
							{onFileClick}
							{activeFilePath}
						/>
					{/if}
				</div>
			{:else if file.isFile}
				<button
					onclick={() => onFileClick?.(folderPath, file.name)}
					class={cn(
						'flex w-full items-center gap-2 rounded px-4 py-1 text-left',
						'cursor-pointer transition-colors hover:bg-gray-700',
						activeFilePath === folderPath
							? 'bg-primary/5 text-primary hover:bg-primary/5'
							: 'text-gray-300'
					)}
					style="padding-left: {depth * 16 + 16}px"
				>
					<FileIcon
						size={20}
						class={cn(activeFilePath === folderPath ? 'text-primary' : 'text-gray-400')}
					/>
					<span>{file.name}</span>
				</button>
			{/if}
		{/each}
	</div>
{/if}
