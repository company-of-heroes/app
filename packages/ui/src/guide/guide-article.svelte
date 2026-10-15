<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushBand,
		flushHeaderTitle,
		guideProse,
		interactive
	} from '@company-of-heroes/ui/variants';
	import ClockIcon from 'phosphor-svelte/lib/ClockIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import PlayerLabels from '../player/player-labels.svelte';
	import PlayerStreamerIcon from '../player/player-streamer-icon.svelte';
	import StatisticsInfoPopover from '../statistics/statistics-info-popover.svelte';
	import { InfoPopover } from '../statistics/info-popover.svelte';
	import { renderGuideMarkdown } from './markdown';
	import { guideLinkClicks } from './guide-link-clicks';
	import { wikiLinkPopovers } from './wiki-link-popovers';
	import type { Guide } from './types';

	type Props = {
		guide: Guide;
	};

	let { guide }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
	/** Unit, upgrade and commander links in the text show the wiki's stats popover on hover. */
	const popover = new InfoPopover();

	const rendered = $derived(
		renderGuideMarkdown(guide.body, {
			imageOrigins: [host.resolve.filesOrigin()],
			href: host.href
		})
	);
	const sections = $derived(rendered.headings.filter((heading) => heading.level === 2));
	const avatar = $derived(
		host.resolve.userAvatar(
			{ id: guide.author.id, avatarUrl: guide.author.avatarUrl ?? undefined },
			{ thumb: '100x100' }
		)
	);
	/** The author's player profile and labels, when their account has a Steam ID. */
	const profileHref = $derived(
		guide.author.steamId ? host.routes.player(guide.author.steamId) : null
	);
	const labels = $derived(
		guide.author.steamId ? host.api.labels.forSteamId(guide.author.steamId) : []
	);
	/** Edits more than a day after publishing are worth a mention. */
	const updatedLater = $derived(
		guide.publishedAt &&
			new Date(guide.updated).getTime() - new Date(guide.publishedAt).getTime() > 86_400_000
	);
</script>

<article class="min-w-0">
	<header class="border-secondary-800 border-b px-4 py-6 sm:px-6">
		{#if guide.status === 'draft'}
			<Badge variant="warning" class="mb-3">{t('Draft')}</Badge>
		{/if}
		<h1 class="font-heading text-3xl leading-tight font-bold text-white sm:text-4xl">
			{guide.title || t('Untitled guide')}
		</h1>
		{#if guide.excerpt}
			<p class="text-secondary-300 mt-3 max-w-3xl text-lg leading-snug">{guide.excerpt}</p>
		{/if}
		<div class="text-secondary-400 mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
			<span class="flex min-w-0 flex-wrap items-center gap-2">
				{#if avatar}
					<img src={avatar} alt="" class="size-6 rounded-full object-cover" loading="lazy" />
				{/if}
				{#if profileHref}
					<a
						href={profileHref}
						rel="author"
						class={cn(interactive, 'hover:text-primary font-medium text-white transition-colors')}
					>
						{guide.author.name}
					</a>
				{:else}
					<span class="font-medium text-white">{guide.author.name}</span>
				{/if}
				<PlayerStreamerIcon steamId={guide.author.steamId} />
				<PlayerLabels {labels} />
			</span>
			{#if guide.publishedAt}
				<time datetime={guide.publishedAt}>{formatDate(guide.publishedAt, host.locale())}</time>
			{/if}
			{#if updatedLater}
				<span>{t('Updated {date}', { date: formatDate(guide.updated, host.locale()) })}</span>
			{/if}
			<span class="flex items-center gap-1">
				<ClockIcon size={14} />
				{t('{count} min read', { count: guide.readingMinutes })}
			</span>
			{#if guide.canEdit}
				<Button
					variant="secondary"
					size="sm"
					href={host.routes.guideEdit(guide.id)}
					class="ml-auto"
				>
					<PencilSimpleIcon size={14} />
					{t('Edit')}
				</Button>
			{/if}
		</div>
	</header>
	{#if guide.coverUrl}
		<figure class="border-secondary-800 border-b">
			<img
				src={guide.coverUrl}
				alt={guide.title}
				width="1200"
				height="630"
				class="aspect-[1.91/1] w-full object-cover"
				decoding="async"
			/>
		</figure>
	{/if}
	{#if sections.length >= 3}
		<!-- A flush panel: header band, then one numbered row per section split by lines. -->
		<nav aria-label={t('In this guide')} class="border-secondary-800 border-b">
			<div class={cn(flushBand, 'px-4 py-2.5 sm:px-6')}>
				<p class={flushHeaderTitle}>{t('In this guide')}</p>
			</div>
			<ol class="divide-secondary-800 divide-y">
				{#each sections as heading, index (heading.id)}
					<li>
						<a
							href="#{heading.id}"
							class={cn(
								interactive,
								'group text-secondary-300 hover:bg-secondary-800/20 flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:text-white sm:px-6'
							)}
						>
							<span
								class="text-secondary-500 group-hover:text-primary w-5 shrink-0 text-xs font-semibold tabular-nums transition-colors"
							>
								{String(index + 1).padStart(2, '0')}
							</span>
							<span class="min-w-0 flex-1 truncate">{heading.text}</span>
						</a>
					</li>
				{/each}
			</ol>
		</nav>
	{/if}
	<div class="px-4 py-6 sm:px-6">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- rendered by renderGuideMarkdown, which escapes raw HTML -->
		<div
			class={cn(guideProse, 'mx-auto max-w-3xl')}
			{@attach wikiLinkPopovers(popover)}
			{@attach guideLinkClicks(host)}
		>
			{@html rendered.html}
		</div>
	</div>
	{#if guide.translations.length}
		<footer
			class="border-secondary-800 text-secondary-400 flex flex-wrap items-center gap-2 border-t px-4 py-3 text-sm sm:px-6"
		>
			<span>{t('Also available in')}</span>
			{#each guide.translations as translation (translation.language)}
				<a
					href={host.routes.guideIn(translation.path, translation.language)}
					class={cn(interactive, 'hover:text-primary font-medium text-white')}
					hreflang={translation.language}
				>
					{translation.language.toUpperCase()}
				</a>
			{/each}
		</footer>
	{/if}
</article>

<StatisticsInfoPopover {popover} />
