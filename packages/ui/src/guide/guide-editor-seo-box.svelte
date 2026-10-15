<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { GUIDE_SEO_DESCRIPTION_MAX, GUIDE_SEO_TITLE_MAX } from '@company-of-heroes/api/guides';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderDescription,
		flushHeaderTitle
	} from '@company-of-heroes/ui/variants';
	import { Checkbox, Input, Textarea } from '../ui/input';
	import { Label } from '../ui/label';
	import { useGuideEditor } from './guide-editor.context.svelte';

	const { t } = useI18n();
	const editor = useGuideEditor();

	const previewTitle = $derived(
		editor.seoTitle.trim() || editor.title.trim() || t('Untitled guide')
	);
	const previewDescription = $derived(editor.seoDescription.trim() || editor.excerpt.trim());
	const previewPath = $derived(
		['coh1stats.com', 'guides', ...editor.categoryPath.split('/').filter(Boolean), editor.slug]
			.filter(Boolean)
			.join(' › ')
	);
	const counter = (length: number, max: number) =>
		cn('text-right text-xs tabular-nums', length > max ? 'text-destructive' : 'text-secondary-500');
</script>

<section>
	<div class={flushHeader}>
		<h2 class={flushHeaderTitle}>{t('Search engines')}</h2>
		<p class={flushHeaderDescription}>
			{t('What Google and social networks show. Left empty, the title and summary are used.')}
		</p>
	</div>
	<div class="flex flex-col gap-3 px-4 py-3">
		<div class="border-secondary-800 bg-secondary-950 rounded-md border px-3 py-2">
			<p class="text-secondary-500 truncate text-xs">{previewPath}</p>
			<p class="truncate text-base font-medium text-sky-400">{previewTitle}</p>
			<p class="text-secondary-300 line-clamp-2 text-xs leading-snug">
				{previewDescription || t('Add a summary so search results have a description.')}
			</p>
		</div>
		<div class="flex flex-col gap-1.5">
			<Label for="guide-seo-title">{t('Search title')}</Label>
			<Input
				id="guide-seo-title"
				size="sm"
				bind:value={editor.seoTitle}
				maxlength={GUIDE_SEO_TITLE_MAX}
				placeholder={editor.title.trim() || t('Same as the title')}
				disabled={editor.saving}
			/>
			<p class={counter(editor.seoTitle.length, GUIDE_SEO_TITLE_MAX)}>
				{editor.seoTitle.length} / {GUIDE_SEO_TITLE_MAX}
			</p>
		</div>
		<div class="flex flex-col gap-1.5">
			<Label for="guide-seo-description">{t('Search description')}</Label>
			<Textarea
				id="guide-seo-description"
				rows={3}
				bind:value={editor.seoDescription}
				maxlength={GUIDE_SEO_DESCRIPTION_MAX}
				placeholder={editor.excerpt.trim() || t('Same as the summary')}
				disabled={editor.saving}
			/>
			<p class={counter(editor.seoDescription.length, GUIDE_SEO_DESCRIPTION_MAX)}>
				{editor.seoDescription.length} / {GUIDE_SEO_DESCRIPTION_MAX}
			</p>
		</div>
		<Checkbox
			id="guide-noindex"
			size="sm"
			bind:checked={editor.noindex}
			label={t('Hide from search engines (noindex)')}
			disabled={editor.saving}
		/>
	</div>
</section>
