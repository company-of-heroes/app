<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Badge } from '@company-of-heroes/ui/badge';
	import * as List from '@company-of-heroes/ui/list';
	import { cn } from '@company-of-heroes/ui/cn';
	import { detailMetaGrid } from '@company-of-heroes/ui/variants';
	import { renderMarkdown } from '../comment/markdown';
	import ChecksIcon from 'phosphor-svelte/lib/ChecksIcon';
	import HourglassIcon from 'phosphor-svelte/lib/HourglassIcon';
	import RankingIcon from 'phosphor-svelte/lib/RankingIcon';
	import DetailHeader from './replay-detail-header.svelte';

	type Props = {
		title: string;
		map: string;
		resolveMapSrc: (map: string | undefined) => string | undefined;
		resolveFallbackSrc?: () => string | undefined;
		showNav?: boolean;
		listHref: string;
		replaysLabel: string;
		backAriaLabel?: string;
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
		downloadLabel?: string;
		downloadsLabel?: string;
		onDownloadClick?: () => void;
		description?: string | null;
		descriptionLabel?: string;
		statusLabel: string;
		titleLabel: string;
		submittedAtLabel: string;
		playerCountLabel: string;
		uploadedByLabel: string;
		durationLabel: string;
		gameModeLabel: string;
		resultSavedLabel?: string;
		resultPendingLabel?: string;
		rankedMatchLabel?: string;
		deletedLabel?: string;
		showDeletedBadge?: boolean;
		titleMeta?: Snippet;
		actions?: Snippet;
		afterDetails?: Snippet;
		vote?: Snippet;
	};

	let {
		title,
		map,
		resolveMapSrc,
		resolveFallbackSrc,
		showNav = true,
		listHref,
		replaysLabel,
		backAriaLabel,
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
		downloadLabel,
		downloadsLabel,
		onDownloadClick,
		description = null,
		descriptionLabel = 'Description',
		statusLabel,
		titleLabel,
		submittedAtLabel,
		playerCountLabel,
		uploadedByLabel,
		durationLabel,
		gameModeLabel,
		resultSavedLabel = 'Result saved',
		resultPendingLabel = 'Result pending',
		rankedMatchLabel = 'Ranked match',
		deletedLabel = 'Deleted',
		showDeletedBadge = false,
		titleMeta: extraTitleMeta,
		actions,
		afterDetails,
		vote
	}: Props = $props();

	const descriptionTrimmed = $derived(description?.trim() || '');
	const descriptionHtml = $derived(
		descriptionTrimmed ? renderMarkdown(descriptionTrimmed) : ''
	);
	const markdownClass = cn(
		'prose prose-sm max-w-none min-w-0 break-words text-secondary-200',
		'prose-headings:my-1 prose-headings:text-sm prose-headings:leading-snug prose-headings:text-white',
		'prose-h1:text-base prose-strong:text-white',
		'prose-code:bg-secondary-800 prose-code:text-primary prose-code:rounded prose-code:px-1 prose-code:py-0.5',
		'prose-code:before:content-none prose-code:after:content-none',
		'prose-pre:my-1 prose-pre:overflow-x-auto prose-pre:bg-secondary-900 prose-pre:border-secondary-800 prose-pre:border',
		'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
		'prose-blockquote:border-secondary-700 prose-blockquote:text-primary',
		'prose-li:marker:text-secondary-400',
		'[&_mark]:bg-primary/20 [&_mark]:text-primary [&_mark]:rounded-sm',
		'[&_.mention]:text-primary [&_.mention]:font-medium',
		'[&_a.mention]:cursor-pointer hover:[&_a.mention]:underline',
		'prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-blockquote:my-1',
		'[&>*:first-child]:mt-0 [&>*:last-child]:mb-0'
	);
</script>

<DetailHeader
	mapName={title}
	{map}
	{listHref}
	{resolveMapSrc}
	{resolveFallbackSrc}
	{showNav}
	{showDownload}
	{downloadHref}
	{downloadFileName}
	{downloadDisabled}
	{downloadCount}
	{downloadLabel}
	{downloadsLabel}
	{onDownloadClick}
	{replaysLabel}
	{backAriaLabel}
	{actions}
	{afterDetails}
	{vote}
>
	{#snippet titleMeta()}
		{#if showDeletedBadge}
			<Badge variant="warning">{deletedLabel}</Badge>
		{/if}
		{@render extraTitleMeta?.()}
	{/snippet}
	{#snippet details()}
		<div class={detailMetaGrid}>
			<List.Title>{statusLabel}</List.Title>
			<List.Value class="flex items-center">
				{#if statusPending}
					<span title={resultPendingLabel}>
						<HourglassIcon class="text-primary" />
					</span>
				{:else}
					<span title={resultSavedLabel}>
						<ChecksIcon class="text-green-400" />
					</span>
				{/if}
			</List.Value>
			<List.Title>{titleLabel}</List.Title>
			<List.Value>
				{#if isRanked}
					<span class="flex items-center" title={rankedMatchLabel}>
						<RankingIcon class="text-primary-100" weight="duotone" />
					</span>
				{:else}
					<span class="truncate">{titleValue}</span>
				{/if}
			</List.Value>

			<List.Title>{submittedAtLabel}</List.Title>
			<List.Value>{submittedAt}</List.Value>
			<List.Title>{playerCountLabel}</List.Title>
			<List.Value>{playerCount}</List.Value>

			<List.Title>{uploadedByLabel}</List.Title>
			<List.Value>{uploadedBy}</List.Value>
			<List.Title>{durationLabel}</List.Title>
			<List.Value>{duration}</List.Value>

			<List.Title>{gameModeLabel}</List.Title>
			<List.Value>{gameMode}</List.Value>
		</div>
	{/snippet}
	{#snippet afterActions()}
		{#if descriptionHtml}
			<div class="mt-4">
				<h2 class="font-heading text-lg font-bold text-white">{descriptionLabel}</h2>
				<div class={cn(markdownClass, 'mt-2')}>
					{@html descriptionHtml}
				</div>
			</div>
		{/if}
	{/snippet}
</DetailHeader>
