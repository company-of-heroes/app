<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { markdownProse } from '@company-of-heroes/ui/variants';
	import MegaphoneIcon from 'phosphor-svelte/lib/MegaphoneIcon';
	import { renderMarkdown } from '../comment/markdown';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Button } from '../ui/button';
	import { modal } from '../ui/modal';
	import { postSummary, postTitle } from './format';
	import type { TournamentPostNotice } from './types';

	type Props = { notice: TournamentPostNotice };

	let { notice }: Props = $props();
	const { t } = useI18n();
	const host = useHost();

	const post = $derived(notice.post);
	const summary = $derived(
		postSummary(t, post, (iso) => formatDate(iso, host.locale(), 'dateTime'))
	);
	const warning = $derived(post.kind === 'cancelled' || post.kind === 'disqualified');
</script>

<div class="flex flex-col">
	<div class="flex gap-4 px-5 pt-6 pb-5">
		<span
			class={cn(
				'flex size-12 shrink-0 items-center justify-center rounded-full',
				warning ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'
			)}
		>
			<MegaphoneIcon size={26} weight="duotone" />
		</span>
		<div class="flex min-w-0 flex-col gap-1">
			<p class="text-secondary-400 text-sm">{notice.tournament.name}</p>
			<h2 class="font-heading text-2xl leading-tight font-bold text-white">
				{postTitle(t, post)}
			</h2>
			{#if summary}
				<p class="text-secondary-300 text-sm">{summary}</p>
			{/if}
		</div>
	</div>
	{#if post.body}
		<div class="border-secondary-800 max-h-80 overflow-y-auto border-t px-5 py-4">
			<div class={cn(markdownProse, 'text-sm')}>
				{@html renderMarkdown(post.body)}
			</div>
		</div>
	{/if}
	<div class="border-secondary-800 flex flex-wrap justify-end gap-2 border-t px-5 py-4">
		<Button variant="ghost" onclick={() => modal.close()}>{t('Close')}</Button>
		<Button
			href={`${host.routes.tournament(notice.tournament.slug)}?tab=${post.kind === 'rules' ? 'info' : 'updates'}`}
			onclick={() => modal.close()}
		>
			{post.kind === 'rules' ? t('Read the rules') : t('View updates')}
		</Button>
	</div>
</div>
