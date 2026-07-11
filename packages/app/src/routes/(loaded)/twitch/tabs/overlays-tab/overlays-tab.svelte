<script lang="ts">
	import type { Overlay } from '$features/twitch-overlays/overlays/overlay.svelte';
	import * as monaco from 'monaco-editor';
	import Editor from '$lib/components/ui/input/editor.svelte';
	import CopyIcon from 'phosphor-svelte/lib/CopyIcon';
	import FileTree from './file-tree.svelte';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import FloppyDiskIcon from 'phosphor-svelte/lib/FloppyDiskIcon';
	import { openPath } from '@tauri-apps/plugin-opener';
	import { confirm } from '@tauri-apps/plugin-dialog';
	import { twitchOverlays } from '$features/twitch-overlays';
	import { cn } from '$lib/utils';
	import { watch } from 'runed';
	import { app } from '$core/app/context';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { ToggleGroup } from '$lib/components/ui/toggle-group';
	import * as Form from '$lib/components/ui/form';

	type OpenFile = {
		path: string;
		name: string;
		content: string;
		originalContent: string;
		language: string;
	};

	let selectedOverlay = $state(twitchOverlays.overlays[0]);
	let overlaySelection = $state(twitchOverlays.overlays[0].name);
	let copied = $state(false);
	let openFiles = $state<OpenFile[]>([]);
	let activeFileIndex = $state(-1);
	let editorInstance = $state<monaco.editor.IStandaloneCodeEditor>();
	let editorContainer = $state<HTMLDivElement>();

	const overlayItems = $derived(
		twitchOverlays.overlays.map((overlay) => ({
			value: overlay.name,
			label: overlay.name
		}))
	);

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
			jsx: 'javascript',
			tsx: 'typescript',
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
		if (isImageFile(fileName)) {
			app.toast.info(`Cannot edit image files: ${fileName}`);
			return;
		}

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

	async function switchOverlay(overlayName: string) {
		const overlay = twitchOverlays.overlays.find((item) => item.name === overlayName);
		if (!overlay || overlay.name === selectedOverlay.name) return;

		if (hasUnsavedChanges) {
			const confirmSwitch = await confirm(
				'You have unsaved changes. Switch overlays anyway? All changes will be lost.'
			);
			if (!confirmSwitch) {
				overlaySelection = selectedOverlay.name;
				return;
			}
		}

		openFiles = [];
		activeFileIndex = -1;
		selectedOverlay = overlay;
		overlaySelection = overlay.name;
	}

	watch(
		() => overlaySelection,
		(name) => {
			if (name && name !== selectedOverlay.name) {
				void switchOverlay(name);
			}
		}
	);

	$effect(() => {
		if (editorInstance) {
			const model = editorInstance.getModel();

			if (activeFile && model) {
				monaco.editor.setModelLanguage(model, activeFile.language);
				if (model.getValue() !== activeFile.content) {
					model.setValue(activeFile.content);
				}
			} else if (!activeFile && model) {
				editorInstance.setModel(null);
			}
		}
	});

	$effect(() => {
		function handleKeyDown(e: KeyboardEvent) {
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

<ToggleGroup items={overlayItems} bind:value={overlaySelection} class="w-fit" />
<Form.Root class="mt-4">
	<Form.Group>
		<Form.Label for="overlay-url">Overlay URL</Form.Label>
		<Form.Description>
			Use this URL in your streaming software to add the overlay to your stream.
		</Form.Description>
		<div class="relative flex">
			<Input
				id="overlay-url"
				readonly
				value={`http://localhost:9000/${selectedOverlay.path.replace('overlays/', '')}/index.html`}
				class={cn(copied && 'border-success bg-success/5')}
			/>
			<Button
				variant="ghost"
				size="icon-sm"
				type="button"
				class={cn(
					'text-secondary-400 absolute top-1.5 right-1.5',
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
			</Button>
		</div>
	</Form.Group>
</Form.Root>
<div class="mt-6">
	<Form.Label>File editor</Form.Label>
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
				<Button
					variant="ghost"
					size="sm"
					type="button"
					class="text-secondary-200 hover:text-secondary-100 px-0 text-xs font-light"
					onclick={async () => openPath(await selectedOverlay.getPath())}
				>
					Open in explorer
				</Button>
				{#if hasUnsavedChanges}
					<Button
						variant="ghost"
						size="sm"
						type="button"
						class="text-primary hover:text-secondary-300 gap-1 px-0 text-xs"
						onclick={saveFile}
					>
						<FloppyDiskIcon size={14} />
						save
					</Button>
				{/if}
			</div>
		</div>
		<div class="flex flex-col">
			<div class="flex gap-1 p-1">
				{#each openFiles as file, index}
					<div
						class={cn(
							'flex items-center gap-2 rounded px-2 py-1 text-sm transition-colors',
							activeFileIndex === index
								? 'bg-secondary-800/30 text-white'
								: 'text-secondary-400 hover:bg-secondary-800/50 hover:text-secondary-200'
						)}
					>
						<Button
							variant="ghost"
							size="sm"
							class="h-auto flex-1 justify-start px-1 py-0"
							onclick={() => (activeFileIndex = index)}
						>
							<span class={cn(file.content !== file.originalContent && 'italic')}>
								{file.name}
								{#if file.content !== file.originalContent}
									<span class="text-primary">*</span>
								{/if}
							</span>
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							class="size-6"
							onclick={(e) => closeFile(index, e)}
							title="Close"
						>
							<XIcon size={14} />
						</Button>
					</div>
				{/each}
			</div>

			<div class="flex grow">
				{#if activeFile}
					<Editor
						bind:container={editorContainer}
						bind:editor={editorInstance}
						bind:value={activeFile.content}
						bind:language={activeFile.language}
						path={activeFile.path}
					/>
				{/if}
			</div>
		</div>
	</div>
</div>
