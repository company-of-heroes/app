<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { onMount, untrack, type Component } from 'svelte';
	import { watch } from 'runed';
	import type { AnyExtension, Editor } from '@tiptap/core';
	import { cn } from '@company-of-heroes/ui/cn';
	import { controlBase, markdownProse } from '../../variants';
	import ArrowClockwiseIcon from 'phosphor-svelte/lib/ArrowClockwiseIcon';
	import ArrowCounterClockwiseIcon from 'phosphor-svelte/lib/ArrowCounterClockwiseIcon';
	import BookOpenIcon from 'phosphor-svelte/lib/BookOpenIcon';
	import ImageSquareIcon from 'phosphor-svelte/lib/ImageSquareIcon';
	import LinkSimpleIcon from 'phosphor-svelte/lib/LinkSimpleIcon';
	import ListBulletsIcon from 'phosphor-svelte/lib/ListBulletsIcon';
	import ListNumbersIcon from 'phosphor-svelte/lib/ListNumbersIcon';
	import QuotesIcon from 'phosphor-svelte/lib/QuotesIcon';
	import SpinnerIcon from 'phosphor-svelte/lib/SpinnerIcon';
	import TextBIcon from 'phosphor-svelte/lib/TextBIcon';
	import TextHThreeIcon from 'phosphor-svelte/lib/TextHThreeIcon';
	import TextHTwoIcon from 'phosphor-svelte/lib/TextHTwoIcon';
	import TextItalicIcon from 'phosphor-svelte/lib/TextItalicIcon';
	import TextStrikethroughIcon from 'phosphor-svelte/lib/TextStrikethroughIcon';
	import { Button } from '../button';
	import { Input } from '../input';
	import { tooltip } from '../../attachments';
	import WikiLinkPicker from './wiki-link-picker.svelte';

	type Props = {
		/** Markdown; updated while typing. */
		value?: string;
		id?: string;
		placeholder?: string;
		/** Shows a counter; the markdown length counts. */
		maxLength?: number;
		disabled?: boolean;
		/** Accessible name of the editable area. */
		'aria-label'?: string;
		class?: string;
		/** Heading levels in the toolbar; H2 only by default. */
		headingLevels?: (2 | 3)[];
		/**
		 * Enables the image tool, paste and drop: uploads the file and resolves its url, which is
		 * inserted as an image. Rejects with a user-facing message.
		 */
		uploadImage?: (file: File) => Promise<{ url: string }>;
		/** Adds the wiki-link tool: search a unit, building, upgrade, … and link to its page. */
		wikiLinks?: boolean;
		/** The link bar also accepts site paths (`/wiki/...`), not only https urls. */
		internalLinks?: boolean;
		/** Upload failures and the like; hosts show a toast. */
		onError?: (message: string) => void;
		/** Taller editing area for long texts. */
		minHeightClass?: string;
	};

	let {
		value = $bindable(''),
		id,
		placeholder = '',
		maxLength,
		disabled = false,
		'aria-label': ariaLabel,
		class: className,
		headingLevels = [2],
		uploadImage,
		wikiLinks = false,
		internalLinks = false,
		onError,
		minHeightClass = 'min-h-32'
	}: Props = $props();
	const { t } = useI18n();

	let element = $state<HTMLDivElement>();
	let editor = $state.raw<Editor | null>(null);
	/** Bumped on every editor change so the toolbar re-reads the active marks. */
	let revision = $state(0);
	let linkOpen = $state(false);
	let linkUrl = $state('');
	let wikiOpen = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let uploading = $state(false);
	/** An uploaded image waiting for its alt text. */
	let pendingImage = $state<{ url: string; alt: string } | null>(null);

	const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

	onMount(() => {
		let instance: Editor | undefined;
		let destroyed = false;
		const withImages = Boolean(untrack(() => uploadImage));
		// Loaded here so server rendering and pages without an editor never pull in Tiptap.
		void Promise.all([
			import('@tiptap/core'),
			import('@tiptap/starter-kit'),
			import('@tiptap/markdown'),
			import('@tiptap/extensions'),
			withImages ? import('@tiptap/extension-image') : Promise.resolve(null)
		]).then(([{ Editor }, { StarterKit }, { Markdown }, { Placeholder }, image]) => {
			if (destroyed || !element) {
				return;
			}

			const extensions: AnyExtension[] = [
				StarterKit.configure({
					heading: { levels: untrack(() => headingLevels) },
					link: { openOnClick: false, autolink: true, protocols: ['http', 'https'] }
				}),
				Markdown,
				Placeholder.configure({ placeholder })
			];
			if (image) {
				extensions.push(image.Image.configure({ inline: false, allowBase64: false }));
			}

			instance = new Editor({
				element,
				extensions,
				content: untrack(() => value),
				contentType: 'markdown',
				editable: !untrack(() => disabled),
				editorProps: {
					attributes: {
						...(id ? { id } : {}),
						...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
						role: 'textbox',
						'aria-multiline': 'true',
						class: cn(markdownProse, minHeightClass, 'px-4 py-3 text-sm outline-none')
					},
					handlePaste: (_view, event) => uploadFromTransfer(event.clipboardData),
					handleDrop: (_view, event, _slice, moved) =>
						!moved && uploadFromTransfer(event.dataTransfer)
				},
				onUpdate: ({ editor: current }) => {
					value = current.getMarkdown();
					revision++;
				},
				onSelectionUpdate: () => {
					revision++;
				}
			});
			editor = instance;
		});

		return () => {
			destroyed = true;
			instance?.destroy();
		};
	});

	watch(
		() => disabled,
		(off) => {
			editor?.setEditable(!off);
		}
	);

	const isActive = (name: string, attributes?: Record<string, unknown>) => {
		void revision;
		return editor?.isActive(name, attributes) ?? false;
	};

	type Tool = {
		label: string;
		icon: Component<{ size?: number }>;
		active?: () => boolean;
		run: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>;
	};

	const headingIcons: Record<2 | 3, Component<{ size?: number }>> = {
		2: TextHTwoIcon,
		3: TextHThreeIcon
	};

	const tools = $derived<Tool[]>([
		{
			label: t('Bold'),
			icon: TextBIcon,
			active: () => isActive('bold'),
			run: (chain) => chain.toggleBold()
		},
		{
			label: t('Italic'),
			icon: TextItalicIcon,
			active: () => isActive('italic'),
			run: (chain) => chain.toggleItalic()
		},
		{
			label: t('Strikethrough'),
			icon: TextStrikethroughIcon,
			active: () => isActive('strike'),
			run: (chain) => chain.toggleStrike()
		},
		...headingLevels.map(
			(level): Tool => ({
				label: headingLevels.length > 1 ? t('Heading {level}', { level }) : t('Heading'),
				icon: headingIcons[level],
				active: () => isActive('heading', { level }),
				run: (chain) => chain.toggleHeading({ level })
			})
		),
		{
			label: t('Bulleted list'),
			icon: ListBulletsIcon,
			active: () => isActive('bulletList'),
			run: (chain) => chain.toggleBulletList()
		},
		{
			label: t('Numbered list'),
			icon: ListNumbersIcon,
			active: () => isActive('orderedList'),
			run: (chain) => chain.toggleOrderedList()
		},
		{
			label: t('Quote'),
			icon: QuotesIcon,
			active: () => isActive('blockquote'),
			run: (chain) => chain.toggleBlockquote()
		}
	]);

	function apply(tool: Tool) {
		if (editor) {
			tool.run(editor.chain().focus()).run();
		}
	}

	function toggleLink() {
		if (!editor) {
			return;
		}

		if (isActive('link')) {
			editor.chain().focus().extendMarkRange('link').unsetLink().run();
			return;
		}

		linkUrl = '';
		pendingImage = null;
		linkOpen = !linkOpen;
	}

	function validLink(href: string): boolean {
		if (/^https?:\/\/\S+$/i.test(href)) {
			return true;
		}

		return internalLinks && /^\/[a-z0-9-]+(\/[a-z0-9-]+)*\/?$/i.test(href);
	}

	function saveLink() {
		const href = linkUrl.trim();
		if (!editor || !validLink(href)) {
			return;
		}

		editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
		linkOpen = false;
	}

	/** A picked wiki page: links the selection, or inserts the page's name as a link. */
	function insertWikiLink(link: { href: string; name: string }) {
		if (!editor) {
			return;
		}

		if (editor.state.selection.empty) {
			editor
				.chain()
				.focus()
				.insertContent({
					type: 'text',
					text: link.name,
					marks: [{ type: 'link', attrs: { href: link.href } }]
				})
				.run();
			return;
		}

		editor.chain().focus().extendMarkRange('link').setLink({ href: link.href }).run();
	}

	async function upload(file: File) {
		if (!uploadImage || uploading) {
			return;
		}

		if (!IMAGE_TYPES.includes(file.type)) {
			onError?.(t('Use a JPEG, PNG or WebP image.'));
			return;
		}

		uploading = true;
		try {
			const { url } = await uploadImage(file);
			linkOpen = false;
			pendingImage = { url, alt: file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ') };
		} catch (error) {
			onError?.(error instanceof Error ? error.message : t('Could not upload the image.'));
		} finally {
			uploading = false;
		}
	}

	/** Pasted or dropped image files are uploaded; other content is left to the editor. */
	function uploadFromTransfer(data: DataTransfer | null): boolean {
		const file = data
			? Array.from(data.files).find((item) => IMAGE_TYPES.includes(item.type))
			: null;
		if (!file || !uploadImage) {
			return false;
		}

		void upload(file);
		return true;
	}

	function insertImage() {
		if (!editor || !pendingImage) {
			return;
		}

		editor.chain().focus().setImage({ src: pendingImage.url, alt: pendingImage.alt.trim() }).run();
		pendingImage = null;
	}
</script>

<div
	class={cn(
		controlBase,
		'focus-within:border-secondary-600 flex h-auto w-full flex-col overflow-hidden',
		disabled && 'opacity-60',
		className
	)}
>
	<div
		class="border-secondary-800 flex flex-wrap items-center gap-0.5 border-b px-2 py-1"
		role="toolbar"
		aria-label={t('Formatting')}
	>
		{#each tools as tool (tool.label)}
			{@const active = tool.active?.() ?? false}
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class={cn('size-7', active && 'bg-secondary-800 text-primary')}
				aria-label={tool.label}
				{@attach tooltip(tool.label)}
				aria-pressed={active}
				disabled={disabled || !editor}
				onclick={() => apply(tool)}
			>
				<tool.icon size={16} />
			</Button>
		{/each}
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			class={cn('size-7', (isActive('link') || linkOpen) && 'bg-secondary-800 text-primary')}
			aria-label={isActive('link') ? t('Remove link') : t('Add link')}
			{@attach tooltip(isActive('link') ? t('Remove link') : t('Add link'))}
			aria-pressed={isActive('link')}
			disabled={disabled || !editor}
			onclick={toggleLink}
		>
			<LinkSimpleIcon size={16} />
		</Button>
		{#if wikiLinks}
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class={cn('size-7', wikiOpen && 'bg-secondary-800 text-primary')}
				aria-label={t('Link to the wiki')}
				{@attach tooltip(t('Link to the wiki'))}
				disabled={disabled || !editor}
				onclick={() => {
					wikiOpen = true;
				}}
			>
				<BookOpenIcon size={16} />
			</Button>
		{/if}
		{#if uploadImage}
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				class={cn('size-7', pendingImage && 'bg-secondary-800 text-primary')}
				aria-label={t('Add image')}
				{@attach tooltip(t('Add image'))}
				disabled={disabled || !editor || uploading}
				onclick={() => fileInput?.click()}
			>
				{#if uploading}
					<SpinnerIcon size={16} class="animate-spin" />
				{:else}
					<ImageSquareIcon size={16} />
				{/if}
			</Button>
			<input
				bind:this={fileInput}
				type="file"
				accept={IMAGE_TYPES.join(',')}
				class="hidden"
				tabindex="-1"
				onchange={(event) => {
					const input = event.currentTarget;
					const file = input.files?.[0];
					input.value = '';
					if (file) {
						void upload(file);
					}
				}}
			/>
		{/if}
		<span class="bg-secondary-800 mx-1 h-4 w-px" aria-hidden="true"></span>
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			class="size-7"
			aria-label={t('Undo')}
			{@attach tooltip(t('Undo'))}
			disabled={disabled || !editor}
			onclick={() => editor?.chain().focus().undo().run()}
		>
			<ArrowCounterClockwiseIcon size={16} />
		</Button>
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			class="size-7"
			aria-label={t('Redo')}
			{@attach tooltip(t('Redo'))}
			disabled={disabled || !editor}
			onclick={() => editor?.chain().focus().redo().run()}
		>
			<ArrowClockwiseIcon size={16} />
		</Button>
		{#if maxLength}
			<span
				class={cn(
					'text-secondary-500 ml-auto px-1 text-xs tabular-nums',
					value.length > maxLength && 'text-destructive'
				)}
			>
				{value.length} / {maxLength}
			</span>
		{/if}
	</div>
	{#if linkOpen}
		<div class="border-secondary-800 flex items-center gap-2 border-b px-2 py-1.5">
			<Input
				type={internalLinks ? 'text' : 'url'}
				size="sm"
				class="flex-1"
				placeholder={internalLinks ? t('https://… or /wiki/…') : 'https://'}
				aria-label={t('Link address')}
				bind:value={linkUrl}
				onkeydown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						saveLink();
					}

					if (event.key === 'Escape') {
						linkOpen = false;
					}
				}}
			/>
			<Button type="button" size="sm" onclick={saveLink}>{t('Add link')}</Button>
		</div>
	{/if}
	{#if pendingImage}
		<div class="border-secondary-800 flex items-center gap-2 border-b px-2 py-1.5">
			<img src={pendingImage.url} alt="" class="size-8 shrink-0 rounded-sm object-cover" />
			<Input
				type="text"
				size="sm"
				class="flex-1"
				placeholder={t('Describe the image (alt text)')}
				aria-label={t('Image description')}
				bind:value={pendingImage.alt}
				onkeydown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						insertImage();
					}

					if (event.key === 'Escape') {
						pendingImage = null;
					}
				}}
			/>
			<Button type="button" size="sm" onclick={insertImage}>{t('Insert image')}</Button>
		</div>
	{/if}
	<div
		bind:this={element}
		class={cn(
			'relative',
			'[&_.is-editor-empty:first-child]:before:text-secondary-500 [&_.is-editor-empty:first-child]:before:pointer-events-none',
			'[&_.is-editor-empty:first-child]:before:float-left [&_.is-editor-empty:first-child]:before:h-0',
			'[&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
			'[&_img.ProseMirror-selectednode]:ring-primary [&_img]:max-w-full [&_img]:rounded-md [&_img.ProseMirror-selectednode]:ring-2'
		)}
	></div>
</div>

{#if wikiLinks}
	<WikiLinkPicker bind:open={wikiOpen} onPick={insertWikiLink} />
{/if}
