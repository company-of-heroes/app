<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { Editor as TinyEditor } from 'tiny-markdown-editor';
	import { app } from '$core/app/context';
	import { getFileUrl } from '$core/pocketbase';
	import { open } from '@tauri-apps/plugin-dialog';
	import { readFile } from '@tauri-apps/plugin-fs';
	import { fetch } from '@tauri-apps/plugin-http';
	import { basename, pictureDir } from '@tauri-apps/api/path';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import TextB from 'phosphor-svelte/lib/TextBIcon';
	import TextItalic from 'phosphor-svelte/lib/TextItalicIcon';
	import TextStrikethrough from 'phosphor-svelte/lib/TextStrikethroughIcon';
	import ImageSquare from 'phosphor-svelte/lib/ImageSquareIcon';
	import PaperPlaneRight from 'phosphor-svelte/lib/PaperPlaneRightIcon';
	import TrashIcon from 'phosphor-svelte/lib/TrashIcon';

	let {
		value = $bindable(''),
		placeholder = 'Enter message...',
		onsubmit,
		class: className
	}: {
		value?: string;
		placeholder?: string;
		onsubmit?: (val: string) => void;
		class?: string;
	} = $props();

	let editorElement: HTMLElement;
	let editor: TinyEditor | undefined;

	// Track formatting state for toolbar buttons
	let commandState = $state({
		bold: false,
		italic: false,
		strikethrough: false
	});

	onMount(() => {
		// Create the tiny markdown editor
		editor = new TinyEditor({
			element: editorElement,
			content: value || ''
		});

		// Listen for content changes
		editor.addEventListener('change', (e) => {
			value = e.content;
		});

		// Listen for selection changes to update toolbar state
		editor.addEventListener('selection', (e) => {
			if (e.commandState) {
				commandState.bold = !!e.commandState.bold;
				commandState.italic = !!e.commandState.italic;
				commandState.strikethrough = !!e.commandState.strikethrough;
			}
		});

		// Handle Enter key for submission
		editorElement.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				handleSubmit();
			}
		});

		// Set placeholder
		if (placeholder && !value) {
			editorElement.setAttribute('data-placeholder', placeholder);
		}
	});

	// Update editor when value changes externally
	$effect(() => {
		if (editor && value !== undefined && editor.getContent() !== value) {
			editor.setContent(value);
		}
	});

	async function uploadFile(file: File) {
		try {
			const attachment = await app.pocketbase.collection('attachments').create(
				{
					type: 'image',
					file: file
				},
				{ fetch }
			);
			const url = getFileUrl(attachment, attachment.file);
			// Insert image markdown at cursor
			editor?.paste(`![${file.name}](${url})`);
		} catch (err) {
			console.error('Failed to upload image', err);
		}
	}

	async function handleImageSelect() {
		try {
			const dir = await pictureDir();
			const selected = await open({
				defaultPath: dir,
				multiple: true,
				filters: [
					{
						name: 'Images',
						extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg']
					}
				]
			});

			if (selected === null) return;

			const paths = Array.isArray(selected) ? selected : [selected];
			for (const path of paths) {
				const bytes = await readFile(path);
				const name = await basename(path);
				let type = 'image/png';
				if (name.endsWith('.jpg') || name.endsWith('.jpeg')) type = 'image/jpeg';
				else if (name.endsWith('.gif')) type = 'image/gif';
				else if (name.endsWith('.webp')) type = 'image/webp';
				else if (name.endsWith('.svg')) type = 'image/svg+xml';

				const file = new File([bytes], name, { type });
				await uploadFile(file);
			}
		} catch (err) {
			console.error('Image selection failed', err);
		}
	}

	function handleSubmit() {
		if (onsubmit && value.trim()) {
			onsubmit(value);
			value = '';
			editor?.setContent('');
		}
	}
</script>

<div
	class={cn('bg-secondary-800/40 border-secondary-800 flex flex-col rounded-md border', className)}
>
	<!-- Editor Area -->
	<div class="relative p-4">
		<div
			bind:this={editorElement}
			class="w-full resize-none overflow-y-auto bg-transparent wrap-break-word whitespace-pre-wrap [&>div]:outline-none"
		></div>
	</div>

	<!-- Toolbar -->
	<div class="flex items-center justify-between p-2">
		<div class="flex items-center gap-1">
			<Button
				variant={commandState.bold ? 'secondary' : 'ghost'}
				size="icon-sm"
				onclick={() => editor?.wrapSelection('**', '**')}
				title="Bold"
				class={commandState.bold ? '' : 'text-secondary-400 hover:text-secondary-100'}
			>
				<TextB size={20} />
			</Button>
			<Button
				variant={commandState.italic ? 'secondary' : 'ghost'}
				size="icon-sm"
				onclick={() => editor?.wrapSelection('*', '*')}
				title="Italic"
				class={commandState.italic ? '' : 'text-secondary-400 hover:text-secondary-100'}
			>
				<TextItalic size={20} />
			</Button>
			<Button
				variant={commandState.strikethrough ? 'secondary' : 'ghost'}
				size="icon-sm"
				onclick={() => editor?.wrapSelection('~~', '~~')}
				title="Strikethrough"
				class={commandState.strikethrough ? '' : 'text-secondary-400 hover:text-secondary-100'}
			>
				<TextStrikethrough size={20} />
			</Button>

			<div class="bg-secondary-700 mx-2 h-4 w-px"></div>

			<Button
				variant="ghost"
				size="icon-sm"
				onclick={handleImageSelect}
				title="Upload Image"
				class="text-secondary-400 hover:text-secondary-100"
			>
				<ImageSquare size={20} />
			</Button>
		</div>

		<div class="flex items-center">
			<Button variant="ghost" size="sm" class="font-medium" onclick={handleSubmit}>
				Submit
				<PaperPlaneRight size={16} weight="fill" />
			</Button>
		</div>
	</div>
</div>
