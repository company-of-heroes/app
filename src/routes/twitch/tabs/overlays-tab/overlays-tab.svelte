<script lang="ts">
	import * as monaco from 'monaco-editor';
	import Editor from '$lib/components/ui/input/editor.svelte';
	import CopyIcon from 'phosphor-svelte/lib/Copy';
	import FileTree from './file-tree.svelte';
	import CheckIcon from 'phosphor-svelte/lib/Check';
	import XIcon from 'phosphor-svelte/lib/X';
	import FloppyDiskIcon from 'phosphor-svelte/lib/FloppyDisk';
	import { openPath } from '@tauri-apps/plugin-opener';
	import { confirm } from '@tauri-apps/plugin-dialog';
	import { twitchOverlays } from '$features/twitch-overlays';
	import { cn } from '$lib/utils';
	import { app } from '$core/app';
	import type { Overlay } from '$features/twitch-overlays/overlays/overlay.svelte';

	type OpenFile = {
		path: string;
		name: string;
		content: string;
		originalContent: string;
		language: string;
	};

	let selectedOverlay = $state(twitchOverlays.overlays[0]);
	let copied = $state(false);
	let openFiles = $state<OpenFile[]>([]);
	let activeFileIndex = $state(-1);
	let editorInstance = $state<monaco.editor.IStandaloneCodeEditor>();
	let editorContainer = $state<HTMLDivElement>();

	const activeFile = $derived(activeFileIndex >= 0 ? openFiles[activeFileIndex] : null);
	const hasUnsavedChanges = $derived(
		activeFile ? activeFile.content !== activeFile.originalContent : false
	);

	function copyToClipboard() {
		navigator.clipboard.writeText(
			`http://localhost:9000/${selectedOverlay.path.replace('overlays/', '')}/index.html`
		);
		copied = true;

		app.toast.success('Overlay URL copied to clipboard!');

		setTimeout(() => {
			copied = false;
		}, 5000);
	}

	function getLanguageFromFilename(filename: string): string {
		const ext = filename.split('.').pop()?.toLowerCase();
		const languageMap: Record<string, string> = {
			js: 'javascript',
			ts: 'typescript',
			json: 'json',
			html: 'html',
			css: 'css',
			scss: 'scss',
			less: 'less',
			md: 'markdown',
			txt: 'plaintext',
			xml: 'xml',
			svg: 'xml',
			hbs: 'handlebars'
		};
		return languageMap[ext || ''] || 'plaintext';
	}

	function isImageFile(fileName: string): boolean {
		const ext = fileName.split('.').pop()?.toLowerCase();
		const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'tiff', 'tif'];
		return imageExtensions.includes(ext || '');
	}

	async function handleFileClick(filePath: string, fileName: string) {
		// Prevent opening image files
		if (isImageFile(fileName)) {
			app.toast.info(`Cannot edit image files: ${fileName}`);
			return;
		}

		// Check if file is already open
		const existingIndex = openFiles.findIndex((f) => f.path === filePath);
		if (existingIndex !== -1) {
			activeFileIndex = existingIndex;
			return;
		}

		try {
			const content = await selectedOverlay.readFile(filePath);
			const language = getLanguageFromFilename(fileName);

			openFiles.push({
				path: filePath,
				name: fileName,
				content,
				originalContent: content,
				language
			});

			activeFileIndex = openFiles.length - 1;
		} catch (error) {
			console.error('Error reading file:', error);
			app.toast.error(`Failed to open ${fileName}`);
		}
	}

	async function closeFile(index: number, event?: Event) {
		event?.stopPropagation();

		const file = openFiles[index];
		if (file.content !== file.originalContent) {
			const confirmClose = await confirm(`${file.name} has unsaved changes. Close anyway?`);

			if (!confirmClose) {
				return;
			}
		}

		openFiles.splice(index, 1);

		// Adjust active tab index after closing
		if (openFiles.length === 0) {
			activeFileIndex = -1;
		} else if (activeFileIndex >= openFiles.length) {
			activeFileIndex = openFiles.length - 1;
		}
	}

	async function saveFile() {
		if (!activeFile) return;

		try {
			await selectedOverlay.writeFile(activeFile.path, activeFile.content);
			activeFile.originalContent = activeFile.content;
			app.toast.success(`${activeFile.name} saved successfully`);
		} catch (error) {
			console.error('Error saving file:', error);
			app.toast.error(`Failed to save ${activeFile.name}`);
		}
	}

	async function switchOverlay(overlay: Overlay) {
		if (hasUnsavedChanges) {
			const confirmSwitch = await confirm(
				'You have unsaved changes. Switch overlays anyway? All changes will be lost.'
			);
			if (!confirmSwitch) {
				return;
			}
		}

		// Close all open files when switching overlays
		openFiles = [];
		activeFileIndex = -1;
		selectedOverlay = overlay;
	}

	$effect(() => {
		if (editorInstance) {
			const model = editorInstance.getModel();

			if (activeFile && model) {
				// Update editor language and content when active file changes
				monaco.editor.setModelLanguage(model, activeFile.language);
				// Only set value if it's different to avoid cursor reset during editing
				if (model.getValue() !== activeFile.content) {
					model.setValue(activeFile.content);
				}
			} else if (!activeFile && model) {
				// Clear the model when no file is active
				editorInstance.setModel(null);
			}
		}
	});

	$effect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			// Ctrl+S to save
			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault();
				if (hasUnsavedChanges) {
					saveFile();
				}
			}
		}

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<div class="flex gap-4">
	{#each twitchOverlays.overlays as overlay}
		<button
			onclick={() => switchOverlay(overlay)}
			class={cn(
				'text-secondary-600 cursor-pointer py-2 font-semibold transition-colors',
				'data-[active=false]:hover:text-primary/20',
				selectedOverlay.name === overlay.name && 'text-primary'
			)}
			data-active={selectedOverlay.name === overlay.name}
		>
			{overlay.name}
		</button>
	{/each}
</div>
<div class="mt-4 flex flex-col">
	<label for="overlay-url" class="font-medium text-neutral-400">Overlay URL</label>
	<small class="text-secondary-300 mb-2">
		Use this URL in your streaming software to add the overlay to your stream.
	</small>
	<div class="relative flex">
		<input
			id="overlay-url"
			readonly
			value={`http://localhost:9000/${selectedOverlay.path.replace('overlays/', '')}/index.html`}
			class={cn(
				'bg-secondary-800 border-secondary-600 w-full rounded-md border px-4 py-2 shadow-2xs outline-none',
				copied && 'border-success bg-success/5'
			)}
		/>
		<button
			class={cn(
				'text-secondary-400 absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-md p-1 transition-colors',
				'hover:bg-secondary-600 hover:text-secondary-200',
				copied && 'text-success pointer-events-none'
			)}
			onclick={copyToClipboard}
			title="Copy Overlay URL"
		>
			{#if copied}
				<CheckIcon size={20} />
			{:else}
				<CopyIcon size={20} />
			{/if}
		</button>
	</div>
</div>
<div class="mt-6">
	<div class="mb-2 font-medium text-neutral-400">File editor</div>
	<div
		class="border-secondary-700 grid h-[500px] grid-cols-[300px_auto] overflow-clip rounded-lg border bg-[#1E1E1E]/50"
	>
		<div class="border-secondary-700 grid grid-rows-[1fr_auto] overflow-hidden border-r">
			<div class="overflow-auto p-1.5">
				<FileTree
					overlay={selectedOverlay}
					onFileClick={handleFileClick}
					activeFilePath={activeFile?.path}
				/>
			</div>
			<div
				class="border-secondary-700 flex w-full items-center justify-between gap-2 border-t px-3 py-2"
			>
				<button
					onclick={async () => openPath(await selectedOverlay.getPath())}
					type="button"
					class="text-secondary-200 hover:text-secondary-100 cursor-pointer text-xs font-light transition-colors"
				>
					Open in explorer
				</button>
				{#if hasUnsavedChanges}
					<button
						onclick={saveFile}
						type="button"
						class="text-primary hover:text-secondary-300 flex cursor-pointer items-center gap-1 text-xs transition-colors"
					>
						<FloppyDiskIcon size={14} />
						save
					</button>
				{/if}
			</div>
		</div>
		<div class="flex flex-col">
			<!-- Tabs -->
			<div class="flex gap-1 p-1">
				{#each openFiles as file, index}
					<div
						class={cn(
							'flex items-center gap-2 rounded px-2 py-1 text-sm transition-colors',
							activeFileIndex === index
								? 'bg-gray-700/30 text-white'
								: 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
						)}
					>
						<button
							onclick={() => (activeFileIndex = index)}
							class="flex-1 cursor-pointer text-left"
						>
							<span class={cn(file.content !== file.originalContent && 'italic')}>
								{file.name}
								{#if file.content !== file.originalContent}
									<span class="text-primary">*</span>
								{/if}
							</span>
						</button>
						<button
							onclick={(e) => closeFile(index, e)}
							class="cursor-pointer rounded p-0.5 transition-colors hover:bg-gray-600"
							title="Close"
						>
							<XIcon size={14} />
						</button>
					</div>
				{/each}
			</div>

			<!-- Editor -->
			<div class="flex grow">
				{#if activeFile}
					<Editor
						bind:container={editorContainer}
						bind:editor={editorInstance}
						bind:value={activeFile.content}
						bind:language={activeFile.language}
					/>
				{/if}
			</div>
		</div>
	</div>
</div>
