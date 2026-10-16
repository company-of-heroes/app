<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import BookOpenIcon from 'phosphor-svelte/lib/BookOpenIcon';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import { escapeHtml, tooltip } from '../attachments';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import PlayerNameIcons from '../player/player-name-icons.svelte';
	import { Badge } from '../ui/badge';
	import type { GuideSummary } from './types';

	type Props = {
		guides: GuideSummary[];
		emptyMessage: string;
		/** Show each guide's category (the index and top-level categories). */
		showCategory?: boolean;
	};

	let { guides, emptyMessage, showCategory = false }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
</script>

{#if guides.length === 0}
	<div
		class="border-secondary-800 text-secondary-500 flex items-center gap-3 border-b px-4 py-6 text-sm"
	>
		<BookOpenIcon size={20} weight="duotone" class="shrink-0" />
		<p>{emptyMessage}</p>
	</div>
{:else}
	<!-- Cards in columns: every cell draws its right and bottom line; the wrapper clips the right
	edge and the last row's line, then closes the grid with its own line. -->
	<div class="border-secondary-800 overflow-hidden border-b">
		<ul class="-mr-px -mb-px grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
			{#each guides as guide (guide.id)}
				<li class="border-secondary-800 min-w-0 border-r border-b">
					<a
						href={guide.path ? host.routes.guide(guide.path) : host.routes.guides()}
						class={cn(interactive, 'group flex h-full min-w-0 flex-col bg-gray-950')}
					>
						<div class="bg-secondary-900 relative aspect-[1.91/1] overflow-hidden">
							{#if guide.coverThumbUrl}
								<img
									src={guide.coverThumbUrl}
									alt=""
									loading="lazy"
									decoding="async"
									class="size-full object-cover transition-transform duration-500 group-hover:scale-105"
								/>
							{:else}
								<div
									class="from-primary/15 flex size-full items-center justify-center bg-radial-[at_15%_0%] via-transparent to-transparent"
								>
									<BookOpenIcon size={40} weight="duotone" class="text-secondary-600" />
								</div>
							{/if}
							{#if showCategory && guide.category}
								<Badge class="absolute top-3 left-3">{guide.category.name}</Badge>
							{/if}
						</div>
						<div class="flex flex-1 flex-col gap-2 px-4 py-4">
							<h3
								class="font-heading group-hover:text-primary truncate text-lg leading-tight font-bold text-white transition-colors"
								{@attach tooltip(escapeHtml(guide.title || t('Untitled guide')))}
							>
								{guide.title || t('Untitled guide')}
							</h3>
							{#if guide.excerpt}
								<p class="text-secondary-300 line-clamp-3 text-sm leading-snug">{guide.excerpt}</p>
							{/if}
							<div
								class="text-secondary-500 mt-auto flex flex-wrap items-center gap-x-3 pt-2 text-xs"
							>
								<span class="text-secondary-300 inline-flex items-center gap-2 font-medium">
									<PlayerNameIcons steamId={guide.author.steamId} size={14} />
									{guide.author.name}
								</span>
								{#if guide.publishedAt}
									<time datetime={guide.publishedAt}>
										{formatDate(guide.publishedAt, host.locale())}
									</time>
								{/if}
								<span class="flex items-center gap-1">
									<ClockIcon size={12} />
									{t('{count} min', { count: guide.readingMinutes })}
								</span>
							</div>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	</div>
{/if}
