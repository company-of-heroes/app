<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import type { Snippet } from 'svelte';
	import { Badge } from '@company-of-heroes/ui/badge';
	import * as List from '@company-of-heroes/ui/list';
	import { cn } from '@company-of-heroes/ui/cn';
	import { detailMetaGrid, markdownProse } from '@company-of-heroes/ui/variants';
	import { renderMarkdown } from '../comment/markdown';
	import ChecksIcon from 'phosphor-svelte/lib/ChecksIcon';
	import HourglassIcon from 'phosphor-svelte/lib/HourglassIcon';
	import RankingIcon from 'phosphor-svelte/lib/RankingIcon';
	import DetailHeader from './replay-detail-header.svelte';
	import { tooltip } from '../attachments';

	type Props = {
		title: string;
		map: string;
		showNav?: boolean;
		listHref: string;
		isRanked: boolean;
		statusPending?: boolean;
		titleValue: string;
		submittedAt: string;
		playerCount: number | string;
		uploadedBy: string;
		duration: string;
		gameMode: string;
		showDownload?: boolean;
		downloadHref?: string | null;
		downloadFileName?: string;
		downloadDisabled?: boolean;
		downloadCount?: number;
		onDownloadClick?: () => void;
		description?: string | null;
		showDeletedBadge?: boolean;
		titleMeta?: Snippet;
		actions?: Snippet;
		afterDetails?: Snippet;
		vote?: Snippet;
	};

	const { t } = useI18n();

	let {
		title,
		map,
		showNav = true,
		listHref,
		isRanked,
		statusPending = false,
		titleValue,
		submittedAt,
		playerCount,
		uploadedBy,
		duration,
		gameMode,
		showDownload = true,
		downloadHref = null,
		downloadFileName = '',
		downloadDisabled = false,
		downloadCount = 0,
		onDownloadClick,
		description = null,
		showDeletedBadge = false,
		titleMeta: extraTitleMeta,
		actions,
		afterDetails,
		vote
	}: Props = $props();

	const descriptionTrimmed = $derived(description?.trim() || '');
	const descriptionHtml = $derived(descriptionTrimmed ? renderMarkdown(descriptionTrimmed) : '');
</script>

<DetailHeader
	mapName={title}
	{map}
	{listHref}
	{showNav}
	{showDownload}
	{downloadHref}
	{downloadFileName}
	{downloadDisabled}
	{downloadCount}
	{onDownloadClick}
	{actions}
	{afterDetails}
	{vote}
>
	{#snippet titleMeta()}
		{#if showDeletedBadge}
			<Badge variant="warning">{t('Deleted')}</Badge>
		{/if}
		{@render extraTitleMeta?.()}
	{/snippet}
	{#snippet details()}
		<div class={detailMetaGrid}>
			<List.Title>{t('Status')}</List.Title>
			<List.Value class="flex items-center">
				{#if statusPending}
					<span {@attach tooltip(t('Result pending'))}>
						<HourglassIcon class="text-primary" />
					</span>
				{:else}
					<span {@attach tooltip(t('Result saved'))}>
						<ChecksIcon class="text-green-400" />
					</span>
				{/if}
			</List.Value>
			<List.Title>{t('Title')}</List.Title>
			<List.Value>
				{#if isRanked}
					<span class="flex items-center" {@attach tooltip(t('Ranked match'))}>
						<RankingIcon class="text-primary-100" weight="duotone" />
					</span>
				{:else}
					<span class="truncate">{titleValue}</span>
				{/if}
			</List.Value>

			<List.Title>{t('Submitted at')}</List.Title>
			<List.Value>{submittedAt}</List.Value>
			<List.Title>{t('Player count')}</List.Title>
			<List.Value>{playerCount}</List.Value>

			<List.Title>{t('Uploaded by')}</List.Title>
			<List.Value>{uploadedBy}</List.Value>
			<List.Title>{t('Duration')}</List.Title>
			<List.Value>{duration}</List.Value>

			<List.Title>{t('Game mode')}</List.Title>
			<List.Value>{gameMode}</List.Value>
		</div>
	{/snippet}
	{#snippet afterActions()}
		{#if descriptionHtml}
			<div class="mt-4">
				<h2 class="font-heading text-lg font-bold text-white">{t('Description')}</h2>
				<div class={cn(markdownProse, 'mt-2')}>
					{@html descriptionHtml}
				</div>
			</div>
		{/if}
	{/snippet}
</DetailHeader>
