<script lang="ts">
	import type { DocKind } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { flushHeader, flushHeaderTitle, markdownProse } from '@company-of-heroes/ui/variants';
	import LightbulbIcon from 'phosphor-svelte/lib/LightbulbIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import { renderMarkdown } from '../comment/markdown';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { Textarea } from '../ui/input';
	import type { DocsNote } from './types';

	type Props = {
		kind: DocKind;
		slug: string;
		note: DocsNote | null;
	};

	let { kind, slug, note }: Props = $props();
	const host = useHost();
	const { t } = useI18n();

	const NOTE_MAX = 5000;

	let saved = $state<DocsNote | null | undefined>(undefined);
	let editing = $state(false);
	let draft = $state('');
	let saving = $state(false);

	// A tip saved here replaces the loaded one; pages key this component by slug.
	const current = $derived(saved === undefined ? note : saved);
	const canEdit = $derived(Boolean(host.auth.user?.isStaff && host.api.docs));
	const html = $derived(current?.body ? renderMarkdown(current.body) : '');

	function edit() {
		draft = current?.body ?? '';
		editing = true;
	}

	async function save() {
		if (!host.api.docs) {
			return;
		}

		saving = true;
		try {
			saved = await host.api.docs.saveNote(kind, slug, draft);
			editing = false;
			host.notify.success(t('Tip saved.'));
		} catch (error) {
			host.notify.error(error instanceof Error ? error.message : t('Could not save the tip.'));
		} finally {
			saving = false;
		}
	}
</script>

{#if current || canEdit}
	<section class="bg-primary/5">
		<div class={cn(flushHeader, 'flex min-h-12 items-center justify-between gap-3')}>
			<h2 class={cn(flushHeaderTitle, 'text-primary flex items-center gap-2')}>
				<LightbulbIcon size={16} weight="fill" />
				{t('When to use it')}
			</h2>
			{#if canEdit && !editing}
				<Button variant="ghost" size="sm" onclick={edit}>
					<PencilSimpleIcon size={16} />
					{current ? t('Edit tip') : t('Add tip')}
				</Button>
			{/if}
		</div>
		<div class="px-4 py-3">
			{#if editing}
				<Textarea
					bind:value={draft}
					rows={8}
					maxlength={NOTE_MAX}
					placeholder={t(
						'Explain when and how to use this, what it counters and what counters it. Markdown is supported.'
					)}
				/>
				<div class="mt-3 flex items-center justify-between gap-3">
					<span class="text-secondary-500 text-xs tabular-nums">{draft.length} / {NOTE_MAX}</span>
					<div class="flex gap-2">
						<Button
							variant="secondary"
							size="sm"
							disabled={saving}
							onclick={() => (editing = false)}
						>
							{t('Cancel')}
						</Button>
						<Button size="sm" disabled={saving} onclick={save}>{t('Save')}</Button>
					</div>
				</div>
			{:else if current}
				<div class={cn(markdownProse, 'text-sm')}>
					{@html html}
				</div>
				<p class="text-secondary-500 mt-2 text-xs">
					{t('Updated {date}', { date: formatDate(current.updated, host.locale()) })}
				</p>
			{:else}
				<p class="text-secondary-400 text-sm">{t('No tip yet. Staff can add one.')}</p>
			{/if}
		</div>
	</section>
{/if}
