<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import UsersIcon from 'phosphor-svelte/lib/UsersIcon';
	import { Badge } from '../ui/badge';
	import { Skeleton } from '../ui/skeleton';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import type { LiveStream } from './types';
	import { escapeHtml, tooltip } from '../attachments';

	type Props = {
		items: LiveStream[];
		loading?: boolean;
		compact?: boolean;
		liveLabel?: string;
	};

	const { t } = useI18n();

	let { items, loading = false, compact = false }: Props = $props();

	const streamHref = (userName: string) => `https://www.twitch.tv/${userName}`;

	const skeletonCount = $derived(compact ? 6 : 3);
	const gridClass = $derived(
		compact
			? '-mr-px grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
			: '-mr-px grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
	);
	const tileBorder = $derived(
		compact
			? 'border-secondary-800 border-r border-t first:border-t-0 [&:nth-child(2)]:border-t-0 [&:nth-child(3)]:border-t-0 sm:[&:nth-child(4)]:border-t-0 lg:[&:nth-child(5)]:border-t-0 xl:[&:nth-child(6)]:border-t-0'
			: 'border-secondary-800 border-r border-t first:border-t-0 sm:[&:nth-child(2)]:border-t-0 lg:[&:nth-child(3)]:border-t-0'
	);
</script>

{#if loading}
	<div class={gridClass}>
		{#each { length: skeletonCount }, i (i)}
			<div class={tileBorder}>
				<Skeleton class="aspect-video w-full rounded-none" />
				<div class={cn(compact ? 'px-1.5 py-1' : 'space-y-2 p-3')}>
					<Skeleton class={cn('rounded-none', compact ? 'h-3 w-4/5' : 'h-4 w-4/5')} />
					{#if !compact}
						<Skeleton class="h-3 w-1/3 rounded-none" />
					{/if}
				</div>
			</div>
		{/each}
	</div>
{:else if items.length === 0}
	<p class="text-secondary-400 px-4 py-3 text-sm">
		{t('No one is streaming Company of Heroes right now.')}
	</p>
{:else}
	<div class={gridClass}>
		{#each items as stream (stream.id)}
			<a
				href={streamHref(stream.userName)}
				target="_blank"
				rel="noopener noreferrer"
				class={cn(
					interactive,
					tileBorder,
					'rounded-none text-left',
					'hover:bg-secondary-950/80 transition-colors'
				)}
				{@attach tooltip(compact ? escapeHtml(stream.title) : undefined)}
			>
				<div class="bg-secondary-900 relative aspect-video overflow-hidden">
					<img src={stream.thumbnailUrl} alt={stream.title} class="size-full object-cover" />
					{#if !compact}
						<Badge variant="success" pulse class="absolute top-2 left-2">{t('Live')}</Badge>
					{/if}
					<span
						class={cn(
							'absolute flex items-center gap-1 bg-red-600 text-white tabular-nums',
							compact
								? 'right-1 bottom-1 px-1 py-px text-[10px]'
								: 'right-2 bottom-2 px-1.5 py-0.5 text-xs'
						)}
					>
						<UsersIcon size={compact ? 9 : 12} />
						{stream.viewers}
					</span>
				</div>
				<div class={cn('flex min-w-0 flex-col', compact ? 'gap-0 px-1.5 py-1' : 'gap-0.5 p-3')}>
					<p
						class={cn(
							'font-semibold text-white',
							compact ? 'truncate text-[11px] leading-tight' : 'line-clamp-2 text-sm'
						)}
					>
						{compact ? stream.userDisplayName : stream.title}
					</p>
					{#if !compact}
						<p class="text-secondary-400 truncate text-sm">{stream.userDisplayName}</p>
					{/if}
					{#if !compact && stream.gameName}
						<p class="text-secondary-500 truncate text-xs">{stream.gameName}</p>
					{/if}
				</div>
			</a>
		{/each}
	</div>
{/if}
