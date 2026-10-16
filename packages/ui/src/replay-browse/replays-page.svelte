<script lang="ts">
	import type { Snippet } from 'svelte';
	import { useI18n } from '@company-of-heroes/i18n';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';
	import { Button } from '../ui/button';
	import ReplaySectionTabs, { type ReplaySectionTab } from '../replay/replay-section-tabs.svelte';
	import type { ReplaysView } from './types';

	type Props = {
		views: (ReplaySectionTab & { id: ReplaysView })[];
		active: ReplaysView;
		/** Hosts that switch views in place; without it the tabs are links. */
		onSelect?: (view: ReplaysView) => void;
		uploadHref: string;
		/** The big page title; off where the host chrome already shows one (desktop app). */
		showTitle?: boolean;
		/** Next to the tabs, e.g. pagination. */
		aside?: Snippet;
		children: Snippet;
	};

	const { t } = useI18n();

	let { views, active, onSelect, uploadHref, showTitle = true, aside, children }: Props = $props();
</script>

{#snippet shareButton(size: 'sm' | 'md')}
	<Button href={uploadHref} variant="primary" {size} class="shrink-0">
		<UploadSimpleIcon class="size-4" weight="bold" />
		{t('Share replay')}
	</Button>
{/snippet}

<div class="flex min-h-0 flex-1 flex-col">
	{#if showTitle}
		<header
			class="border-secondary-800 from-secondary-950/80 flex flex-wrap items-center justify-between gap-4 border-b bg-linear-to-b to-transparent px-4 py-5"
		>
			<div class="min-w-0">
				<h1 class="font-heading text-2xl font-bold text-white">{t('Replays')}</h1>
				<p class="text-secondary-400 text-sm">
					{t('Watch the best games of the community and share your own.')}
				</p>
			</div>
			{@render shareButton('md')}
		</header>
	{/if}
	<ReplaySectionTabs
		tabs={views}
		{active}
		onSelect={onSelect ? (id) => onSelect(id as ReplaysView) : undefined}
	>
		{#snippet trailing()}
			<div class="ms-auto flex shrink-0 items-center gap-3 py-1.5">
				{@render aside?.()}
				{#if !showTitle}
					{@render shareButton('sm')}
				{/if}
			</div>
		{/snippet}
	</ReplaySectionTabs>
	{@render children()}
</div>
