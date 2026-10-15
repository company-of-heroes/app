<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { GUIDE_LANGUAGES } from '@company-of-heroes/api/guides';
	import ArrowSquareOutIcon from 'phosphor-svelte/lib/ArrowSquareOutIcon';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import { Select } from '../ui/input';
	import { Label } from '../ui/label';
	import { GUIDE_LANGUAGE_NAMES, GUIDE_STATUS_LABELS } from './format';
	import { useGuideEditor } from './guide-editor.context.svelte';
	import type { GuideLanguage } from './types';
	import { flushHeader, flushHeaderTitle } from '@company-of-heroes/ui/variants';

	const { t } = useI18n();
	const host = useHost();
	const editor = useGuideEditor();

	const languageItems = GUIDE_LANGUAGES.map((value) => ({
		value,
		label: GUIDE_LANGUAGE_NAMES[value]
	}));
	const published = $derived(editor.status === 'published');
	const canPublish = $derived(
		Boolean(editor.title.trim() && editor.body.trim() && editor.categoryId)
	);
	const viewHref = $derived(editor.guide.path ? host.routes.guide(editor.guide.path) : null);

	async function remove() {
		if (await editor.remove()) {
			await host.url.goto(host.routes.guidesManage());
		}
	}
</script>

<section>
	<div class={`${flushHeader} flex items-center justify-between gap-3`}>
		<h2 class={flushHeaderTitle}>{t('Publish')}</h2>
		<Badge variant={published ? 'success' : 'warning'}
			>{t(GUIDE_STATUS_LABELS[editor.status])}</Badge
		>
	</div>
	<div class="flex flex-col gap-3 px-4 py-3">
		<div class="flex flex-col gap-1.5">
			<Label>{t('Language')}</Label>
			<Select
				type="single"
				size="sm"
				items={languageItems}
				value={editor.language}
				onValueChange={(value: string) => {
					editor.language = value as GuideLanguage;
				}}
				disabled={editor.saving}
				aria-label={t('Language')}
			/>
		</div>
		<dl class="text-secondary-400 flex flex-col gap-1 text-xs">
			{#if editor.guide.publishedAt}
				<div class="flex justify-between gap-2">
					<dt>{t('Published')}</dt>
					<dd class="text-secondary-200">{formatDate(editor.guide.publishedAt, host.locale())}</dd>
				</div>
			{/if}
			<div class="flex justify-between gap-2">
				<dt>{t('Last saved')}</dt>
				<dd class="text-secondary-200">
					{formatDate(editor.guide.updated, host.locale(), 'dateTime')}
				</dd>
			</div>
			<div class="flex justify-between gap-2">
				<dt>{t('Author')}</dt>
				<dd class="text-secondary-200">{editor.guide.author.name}</dd>
			</div>
		</dl>
		{#if !canPublish}
			<p class="text-secondary-500 text-xs">
				{t('A title, some text and a category are needed before publishing.')}
			</p>
		{/if}
		<div class="flex flex-wrap gap-2">
			<Button
				type="button"
				variant={published ? 'primary' : 'secondary'}
				size="sm"
				loading={editor.saving}
				disabled={editor.deleting}
				onclick={() => editor.save()}
			>
				{published ? t('Save changes') : t('Save draft')}
			</Button>
			{#if published}
				<Button
					type="button"
					variant="secondary"
					size="sm"
					disabled={editor.saving || editor.deleting}
					onclick={() => editor.save('draft')}
				>
					{t('Unpublish')}
				</Button>
			{:else}
				<Button
					type="button"
					variant="primary"
					size="sm"
					disabled={!canPublish || editor.saving || editor.deleting}
					onclick={() => editor.save('published')}
				>
					{t('Publish')}
				</Button>
			{/if}
			{#if viewHref}
				<Button variant="ghost" size="sm" href={viewHref}>
					<ArrowSquareOutIcon size={14} />
					{published ? t('View') : t('Preview')}
				</Button>
			{/if}
		</div>
	</div>
	<div class="border-secondary-800 flex justify-end border-t px-4 py-2">
		<Button
			type="button"
			variant="destructive"
			size="sm"
			loading={editor.deleting}
			disabled={editor.saving}
			onclick={remove}
		>
			{t('Delete guide')}
		</Button>
	</div>
</section>
