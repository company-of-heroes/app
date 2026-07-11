<script lang="ts">
	import type { Overlay } from '$core/app/features/twitch-overlays/overlays/overlay.svelte';
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
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
			expandedFolders = new Set(expandedFolders);
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
	<div class="text-secondary-400 py-4 text-sm">Loading files...</div>
{:else}
	<div class="flex flex-col">
		{#each files as file}
			{@const folderPath = path ? `${path}/${file.name}` : file.name}
			{@const expanded = isExpanded(file.name)}

			{#if file.isDirectory}
				<div>
					<Button
						variant="ghost"
						size="sm"
						type="button"
						class="h-auto w-full justify-start gap-2 rounded px-4 py-1 text-left"
						style="padding-left: {depth * 16 + 16}px"
						onclick={() => toggleFolder(file.name)}
					>
						{#if expanded}
							<FolderOpenIcon size={20} class="text-primary" />
						{:else}
							<FolderIcon size={20} class="text-primary" />
						{/if}
						<span class="text-secondary-200">{file.name}</span>
					</Button>

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
				<Button
					variant="ghost"
					size="sm"
					type="button"
					class={cn(
						'h-auto w-full justify-start gap-2 rounded px-4 py-1 text-left',
						activeFilePath === folderPath
							? 'bg-primary/5 text-primary hover:bg-primary/5'
							: 'text-secondary-300'
					)}
					style="padding-left: {depth * 16 + 16}px"
					onclick={() => onFileClick?.(folderPath, file.name)}
				>
					<FileIcon
						size={20}
						class={cn(activeFilePath === folderPath ? 'text-primary' : 'text-secondary-400')}
					/>
					<span>{file.name}</span>
				</Button>
			{/if}
		{/each}
	</div>
{/if}
