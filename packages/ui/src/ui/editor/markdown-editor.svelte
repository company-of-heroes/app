<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { onMount, untrack, type Component } from 'svelte';
	import { watch } from 'runed';
	import type { Editor } from '@tiptap/core';
	import { cn } from '@company-of-heroes/ui/cn';
	import { controlBase, markdownProse } from '../../variants';
	import ArrowClockwiseIcon from 'phosphor-svelte/lib/ArrowClockwiseIcon';
	import ArrowCounterClockwiseIcon from 'phosphor-svelte/lib/ArrowCounterClockwiseIcon';
	import LinkSimpleIcon from 'phosphor-svelte/lib/LinkSimpleIcon';
	import ListBulletsIcon from 'phosphor-svelte/lib/ListBulletsIcon';
	import ListNumbersIcon from 'phosphor-svelte/lib/ListNumbersIcon';
	import QuotesIcon from 'phosphor-svelte/lib/QuotesIcon';
	import TextBIcon from 'phosphor-svelte/lib/TextBIcon';
	import TextHTwoIcon from 'phosphor-svelte/lib/TextHTwoIcon';
	import TextItalicIcon from 'phosphor-svelte/lib/TextItalicIcon';
	import TextStrikethroughIcon from 'phosphor-svelte/lib/TextStrikethroughIcon';
	import { Button } from '../button';
	import { Input } from '../input';
	import { tooltip } from '../../attachments';

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
	};

	let {
		value = $bindable(''),
		id,
		placeholder = '',
		maxLength,
		disabled = false,
		'aria-label': ariaLabel,
		class: className
	}: Props = $props();
	const { t } = useI18n();

	let element = $state<HTMLDivElement>();
	let editor = $state.raw<Editor | null>(null);
	/** Bumped on every editor change so the toolbar re-reads the active marks. */
	let revision = $state(0);
	let linkOpen = $state(false);
	let linkUrl = $state('');

	onMount(() => {
		let instance: Editor | undefined;
		let destroyed = false;
		// Loaded here so server rendering and pages without an editor never pull in Tiptap.
		void Promise.all([
			import('@tiptap/core'),
			import('@tiptap/starter-kit'),
			import('@tiptap/markdown'),
			import('@tiptap/extensions')
		]).then(([{ Editor }, { StarterKit }, { Markdown }, { Placeholder }]) => {
			if (destroyed || !element) {
				return;
			}

			instance = new Editor({
				element,
				extensions: [
					StarterKit.configure({
						heading: { levels: [2, 3] },
						link: { openOnClick: false, autolink: true, protocols: ['http', 'https'] }
					}),
					Markdown,
					Placeholder.configure({ placeholder })
				],
				content: untrack(() => value),
				contentType: 'markdown',
				editable: !untrack(() => disabled),
				editorProps: {
					attributes: {
						...(id ? { id } : {}),
						...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
						role: 'textbox',
						'aria-multiline': 'true',
						class: cn(markdownProse, 'min-h-32 px-4 py-3 text-sm outline-none')
					}
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
		{
			label: t('Heading'),
			icon: TextHTwoIcon,
			active: () => isActive('heading', { level: 2 }),
			run: (chain) => chain.toggleHeading({ level: 2 })
		},
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
		linkOpen = !linkOpen;
	}

	function saveLink() {
		const href = linkUrl.trim();
		if (!editor || !/^https?:\/\/\S+$/i.test(href)) {
			return;
		}

		editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
		linkOpen = false;
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
				type="url"
				size="sm"
				class="flex-1"
				placeholder="https://"
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
	<div
		bind:this={element}
		class={cn(
			'relative',
			'[&_.is-editor-empty:first-child]:before:text-secondary-500 [&_.is-editor-empty:first-child]:before:pointer-events-none',
			'[&_.is-editor-empty:first-child]:before:float-left [&_.is-editor-empty:first-child]:before:h-0',
			'[&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]'
		)}
	></div>
</div>
