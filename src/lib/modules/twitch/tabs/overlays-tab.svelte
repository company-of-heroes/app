<script lang="ts">
	import { type editor as Monaco } from 'monaco-editor';
	import * as monaco from 'monaco-editor';
	import { readDir, type DirEntry } from '@tauri-apps/plugin-fs';
	import { revealItemInDir, openPath } from '@tauri-apps/plugin-opener';
	import { app } from '$core/app';
	import { Command } from '@tauri-apps/plugin-shell';
	import { Editor, Input } from '$lib/components/ui/input';
	import FolderOpen from 'phosphor-svelte/lib/FolderOpen';
	import { appDataDir, join } from '@tauri-apps/api/path';
	import { resource } from 'runed';

	// Import our new composables and components
	import { useFileOperations, type FileEntry } from '../composables/useFileOperations.svelte';
	import { useEditorTabs } from '../composables/useEditorTabs.svelte';
	import FileTree from '../components/FileTree.svelte';
	import TabBar from '../components/TabBar.svelte';
	import OverlayNavigation from '../components/OverlayNavigation.svelte';

	const twitch = app.getModule('twitch');

	// Initialize composables
	const fileOps = useFileOperations(twitch.overlays.overlay.baseDir, twitch.overlays.overlay.path);
	const editorTabs = useEditorTabs(twitch.overlays.overlay.baseDir);

	let files = $state<FileEntry[]>();

	// Set up auto-save
	editorTabs.setupAutoSave(twitch.overlays.overlay.baseDir);

	// Load files when overlay path changes
	resource(
		() => twitch.overlays.overlay.path,
		async () => {
			files = (await fileOps.readDirectory(twitch.overlays.overlay.path)) as FileEntry[];
		}
	);

	// File tree event handlers
	const handleToggleDirectory = async (path: string, file: FileEntry) => {
		await fileOps.toggleDirectory(path, file);
	};

	const handleRename = async (path: string, file: FileEntry) => {
		await fileOps.renameEntry(path, file);
	};

	const handleDelete = async (path: string, file: FileEntry) => {
		await fileOps.deleteEntry(path);

		// Close any open tabs for this file/directory
		if (file.isFile) {
			const tabIndex = editorTabs.openTabs.findIndex((tab) => tab.path === path);
			if (tabIndex !== -1) {
				editorTabs.closeTab(tabIndex);
			}
		} else if (file.isDirectory) {
			editorTabs.closeTabsForPath(path + '/');
		}

		// Refresh file tree
		files = (await fileOps.readDirectory(twitch.overlays.overlay.path)) as FileEntry[];
	};

	const handleOpenFile = async (path: string, fileName: string) => {
		await editorTabs.openFile(path, fileName);
	};

	const handleCreateEntry = (entries: FileEntry[], isDirectory: boolean) => {
		const name = isDirectory ? 'New Folder' : 'New File.txt';
		const entry = fileOps.createNewEntry(name, isDirectory);
		entries.push(entry);
		setTimeout(() => entry.input?.focus());
	};

	// Overlay navigation handler
	const handleSelectOverlay = (overlay: any) => {
		twitch.overlays.overlay = overlay;
	};
</script>

<OverlayNavigation overlays={twitch.overlays.overlays} onSelectOverlay={handleSelectOverlay} />

<div class="mb-4 flex max-w-xl flex-col gap-2">
	<Input
		value={`http://localhost:49220/${twitch.overlays.overlay.path}/{your-overlay-entry}.html`}
		disabled
	/>
	<p class="text-secondary-400 mb-2">Use this page as a browser source in OBS Studio</p>
</div>

{#if files}
	<div class="grid flex-grow grid-cols-[250px_1fr] overflow-hidden">
		<aside class="flex flex-col">
			<FileTree
				entries={files}
				basePath={twitch.overlays.overlay.path}
				onToggleDirectory={handleToggleDirectory}
				onRename={handleRename}
				onDelete={handleDelete}
				onOpenFile={handleOpenFile}
				onCreateEntry={handleCreateEntry}
			/>
			<button
				class="hover:text-primary flex cursor-pointer items-center justify-center gap-2 py-1"
				onclick={async () => {
					openPath(await join(await appDataDir(), twitch.overlays.overlay.path));
				}}
			>
				<FolderOpen />
				Open folder in explorer
			</button>
		</aside>
		<div class="flex flex-col">
			<div class="flex flex-grow flex-col">
				<TabBar
					tabs={editorTabs.openTabs}
					activeTabIndex={editorTabs.activeTabIndex}
					onSwitchTab={editorTabs.switchTab}
					onCloseTab={editorTabs.closeTab}
				/>
				<Editor bind:editor={editorTabs.editor} />
			</div>
		</div>
	</div>
{/if}
