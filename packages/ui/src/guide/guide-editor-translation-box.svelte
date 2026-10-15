<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderDescription,
		flushHeaderTitle,
		interactive
	} from '@company-of-heroes/ui/variants';
	import TranslateIcon from 'phosphor-svelte/lib/TranslateIcon';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { Selection } from '../ui/input';
	import { useGuideEditor } from './guide-editor.context.svelte';
	import type { GuideSummary } from './types';

	const { t } = useI18n();
	const host = useHost();
	const editor = useGuideEditor();

	let open = $state(false);
	let found = $state.raw<GuideSummary[]>([]);

	async function search(query: string) {
		found = await host.api.guides.searchTranslations(editor.language, query);
		return found.map((guide) => ({
			value: guide.id,
			label: `${guide.title} (${guide.language.toUpperCase()})`
		}));
	}
</script>

<section>
	<div class={flushHeader}>
		<h2 class={flushHeaderTitle}>{t('Translations')}</h2>
		<p class={flushHeaderDescription}>
			{t(
				'Link this guide to the same guide in another language, so readers and search engines find both.'
			)}
		</p>
	</div>
	<div class="flex flex-col gap-2 px-4 py-3">
		{#if editor.translationOf}
			<div class="flex items-center gap-2 text-sm">
				<TranslateIcon size={16} class="text-secondary-400 shrink-0" />
				<span class="min-w-0 flex-1 truncate text-white">
					{editor.translationLabel ?? t('Linked to a guide in another language')}
				</span>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label={t('Unlink')}
					disabled={editor.saving}
					onclick={() => editor.setTranslation(null)}
				>
					<XIcon size={14} />
				</Button>
			</div>
		{/if}
		{#if editor.guide.translations.length}
			<ul class="text-secondary-400 flex flex-wrap gap-x-3 text-xs">
				{#each editor.guide.translations as translation (translation.language)}
					<li>
						<a
							href={host.routes.guideIn(translation.path, translation.language)}
							class={cn(interactive, 'hover:text-primary text-white')}
						>
							{translation.language.toUpperCase()}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		<Button
			type="button"
			variant="secondary"
			size="sm"
			class="self-start"
			disabled={editor.saving}
			onclick={() => {
				open = true;
			}}
		>
			<TranslateIcon size={14} />
			{editor.translationOf ? t('Change linked guide') : t('Link a translation')}
		</Button>
		<Selection
			hideTrigger
			bind:open
			options={[]}
			value=""
			onSearch={search}
			onValueChange={(value) =>
				editor.setTranslation(found.find((guide) => guide.id === value) ?? null)}
			searchPlaceholder={t('Search guides in other languages…')}
			noResultsLabel={t('No results found.')}
			searchingLabel={t('Searching…')}
		/>
	</div>
</section>
