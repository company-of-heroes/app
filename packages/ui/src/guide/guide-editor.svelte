<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { untrack } from 'svelte';
	import {
		GUIDE_BODY_MAX,
		GUIDE_EXCERPT_MAX,
		GUIDE_SLUG_MAX,
		GUIDE_TITLE_MAX
	} from '@company-of-heroes/api/guides';
	import { useHost } from '../host/host.context';
	import { MarkdownEditor } from '../ui/editor';
	import * as Form from '../ui/form';
	import { Input, Textarea } from '../ui/input';
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
</script>

<!-- WordPress-like: the text on the left, the publish, cover, SEO and category boxes on the right.
Every block closes with its own line; the grid overlaps the footer's top line by 1px. -->
<div class="divide-secondary-800 -mb-px grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:divide-x">
	<div class="[&>*]:border-secondary-800 min-w-0 [&>*]:border-b">
		<Form.Group label={t('Title')} inputId="guide-title" layout="stacked" wide required>
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
		<Form.Group label={t('Text')} inputId="guide-body" layout="stacked" wide required>
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
	<aside class="[&>*]:border-secondary-800 min-w-0 [&>*]:border-b">
		<GuideEditorPublishBox />
		<GuideEditorCategoryBox />
		<GuideEditorCoverBox />
		<GuideEditorSeoBox />
		<GuideEditorTranslationBox />
	</aside>
</div>
