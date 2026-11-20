<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { untrack } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import {
		GUIDE_BODY_MAX,
		GUIDE_EXCERPT_MAX,
		GUIDE_SLUG_MAX,
		GUIDE_TITLE_MAX,
		readingMinutes
	} from '@company-of-heroes/api/guides';
	import { cn } from '@company-of-heroes/ui/cn';
	import EyeIcon from 'phosphor-svelte/lib/EyeIcon';
	import PencilLineIcon from 'phosphor-svelte/lib/PencilLineIcon';
	import { useHost } from '../host/host.context';
	import { MarkdownEditor } from '../ui/editor';
	import * as Form from '../ui/form';
	import { Input, Textarea } from '../ui/input';
	import * as Tabs from '../ui/tabs';
	import GuideArticle from './guide-article.svelte';
	import { createGuideEditor, GuideEditorState } from './guide-editor.context.svelte';
	import GuideEditorCategoryBox from './guide-editor-category-box.svelte';
	import GuideEditorCoverBox from './guide-editor-cover-box.svelte';
	import GuideEditorPublishBox from './guide-editor-publish-box.svelte';
	import GuideEditorSeoBox from './guide-editor-seo-box.svelte';
	import GuideEditorTranslationBox from './guide-editor-translation-box.svelte';
	import type { Guide, GuideCategoryTree } from './types';

	type Props = {
		guide: Guide;
		categories: GuideCategoryTree[];
	};

	let { guide, categories }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	// Set once at init (before anything async), so the boxes can read it.
	const editor = new GuideEditorState(
		untrack(() => guide),
		untrack(() => categories),
		host,
		t
	);
	createGuideEditor(editor);

	const addressPrefix = $derived(
		editor.categoryPath ? `/guides/${editor.categoryPath}/` : t('/guides/…/')
	);

	/** Write the guide, or see it as readers will (the unsaved form, not the saved guide). */
	let view = $state<'write' | 'preview'>('write');
	/** A picked but not yet uploaded cover, shown in the preview. */
	const coverPreview = $derived(
		editor.cover && view === 'preview' ? URL.createObjectURL(editor.cover) : null
	);
	$effect(() => {
		const url = coverPreview;
		return () => {
			if (url) {
				URL.revokeObjectURL(url);
			}
		};
	});

	const preview = $derived<Guide>({
		...editor.guide,
		title: editor.title,
		excerpt: editor.excerpt,
		body: editor.body,
		coverUrl: editor.clearCover ? null : (coverPreview ?? editor.coverUrl),
		readingMinutes: readingMinutes(editor.body),
		canEdit: false,
		translations: []
	});

	/** Links in the preview must not leave the editor with unsaved changes. */
	const previewLinks: Attachment<HTMLElement> = (element) => {
		element.addEventListener('click', previewClick, true);
		return () => element.removeEventListener('click', previewClick, true);
	};

	function previewClick(event: MouseEvent) {
		const anchor = event.target instanceof Element ? event.target.closest('a') : null;
		const href = anchor?.getAttribute('href');
		if (!anchor || !href || href.startsWith('#')) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		if (/^https?:\/\//i.test(href) && host.openExternal) {
			host.openExternal(href);
			return;
		}

		window.open(anchor.href, '_blank', 'noopener');
	}
</script>

<!-- WordPress-like: the text on the left, the publish, cover, SEO and category boxes on the right.
Every block closes with its own line; the grid overlaps the footer's top line by 1px. -->
<div class="divide-secondary-800 -mb-px grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:divide-x">
	<div class="[&>*]:border-secondary-800 min-w-0 [&>*]:border-b">
		<Tabs.Root
			value={view}
			onValueChange={(value) => {
				view = value === 'preview' ? 'preview' : 'write';
			}}
			class="flex flex-wrap items-center justify-between gap-x-4 px-4"
		>
			<Tabs.List>
				<Tabs.Trigger value="write">
					<PencilLineIcon size={14} />
					{t('Write')}
				</Tabs.Trigger>
				<Tabs.Trigger value="preview">
					<EyeIcon size={14} />
					{t('Preview')}
				</Tabs.Trigger>
			</Tabs.List>
		</Tabs.Root>
		<!-- Kept mounted while previewing, so the editor keeps its undo history. -->
		<div
			class={cn(
				'[&>*:not(:last-child)]:border-secondary-800 [&>*:not(:last-child)]:border-b',
				view === 'preview' && 'hidden'
			)}
		>
			<Form.Group
				label={t('Title')}
				inputId="guide-title"
				layout="stacked"
				wide
				required
				error={editor.errors.title}
			>
				<Input
					id="guide-title"
					value={editor.title}
					oninput={(event) => editor.setTitle(event.currentTarget.value)}
					maxlength={GUIDE_TITLE_MAX}
					placeholder={t('How to start heavy T1 as Wehrmacht')}
					disabled={editor.saving}
				/>
			</Form.Group>
			<Form.Group
				label={t('Address')}
				inputId="guide-slug"
				description={t('Changing the address of a published guide breaks links to it.')}
				layout="stacked"
				wide
			>
				<Input
					id="guide-slug"
					value={editor.slug}
					oninput={(event) => editor.setSlug(event.currentTarget.value)}
					maxlength={GUIDE_SLUG_MAX}
					spellcheck={false}
					disabled={editor.saving}
				>
					{#snippet leading()}
						<span class="text-secondary-500 truncate text-sm leading-none">{addressPrefix}</span>
					{/snippet}
				</Input>
			</Form.Group>
			<Form.Group
				label={t('Summary')}
				inputId="guide-excerpt"
				description={t('One or two sentences shown in lists and search results.')}
				layout="stacked"
				wide
			>
				<Textarea
					id="guide-excerpt"
					rows={2}
					bind:value={editor.excerpt}
					maxlength={GUIDE_EXCERPT_MAX}
					disabled={editor.saving}
				/>
				<p class="text-secondary-500 text-right text-xs tabular-nums">
					{editor.excerpt.length} / {GUIDE_EXCERPT_MAX}
				</p>
			</Form.Group>
			<Form.Group
				label={t('Text')}
				inputId="guide-body"
				description={t(
					'Images on the same line are shown next to each other; press Enter after an image to start a new line.'
				)}
				layout="stacked"
				wide
				required
				error={editor.errors.body}
			>
				<MarkdownEditor
					id="guide-body"
					bind:value={editor.body}
					headingLevels={[2, 3]}
					wikiLinks
					internalLinks
					uploadImage={(file) => editor.uploadImage(file)}
					onError={(message) => host.notify.error(message)}
					maxLength={GUIDE_BODY_MAX}
					minHeightClass="min-h-[32rem]"
					placeholder={t(
						'Write the guide. Use headings for its sections; link units and upgrades from the wiki.'
					)}
					disabled={editor.saving}
				/>
			</Form.Group>
		</div>
		{#if view === 'preview'}
			<div class="min-w-0" {@attach previewLinks}>
				<GuideArticle
					guide={preview}
					notice={t('How readers will see it, unsaved changes included. Links open in a new tab.')}
				/>
			</div>
		{/if}
	</div>
	<aside class="[&>*]:border-secondary-800 min-w-0 [&>*]:border-b">
		<GuideEditorPublishBox />
		<GuideEditorCategoryBox />
		<GuideEditorCoverBox />
		<GuideEditorSeoBox />
		<GuideEditorTranslationBox />
	</aside>
</div>
