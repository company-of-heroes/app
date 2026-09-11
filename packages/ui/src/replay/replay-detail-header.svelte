<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button } from '@company-of-heroes/ui/button';
	import MapImage from '@company-of-heroes/ui/map-image';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import ArrowLeftIcon from 'phosphor-svelte/lib/ArrowLeftIcon';
	import DownloadIcon from 'phosphor-svelte/lib/DownloadIcon';

	type Props = {
		mapName: string;
		map: string;
		downloadHref?: string | null;
		downloadFileName?: string;
		downloadDisabled?: boolean;
		downloadCount: number;
		listHref: string;
		resolveMapSrc: (map: string | undefined) => string | undefined;
		resolveFallbackSrc?: () => string | undefined;
		onDownloadClick?: () => void;
		replaysLabel?: string;
		downloadLabel?: string;
		backAriaLabel?: string;
		downloadsLabel?: string;
		showDownload?: boolean;
		vote?: Snippet;
		title?: Snippet;
		titleMeta?: Snippet;
		details: Snippet;
		actions?: Snippet;
		afterActions?: Snippet;
		afterDetails?: Snippet;
		/** Website-style back + breadcrumb row. App uses its own layout breadcrumbs. */
		showNav?: boolean;
	};

	let {
		mapName,
		map,
		downloadHref = null,
		downloadFileName = '',
		downloadDisabled = false,
		downloadCount,
		listHref,
		resolveMapSrc,
		resolveFallbackSrc,
		onDownloadClick,
		replaysLabel = 'Replays',
		downloadLabel = 'Download replay',
		backAriaLabel = 'Back to replays',
		downloadsLabel = 'Downloads',
		showDownload = true,
		showNav = true,
		vote,
		title,
		titleMeta,
		details,
		actions,
		afterActions,
		afterDetails
	}: Props = $props();
</script>

<div class="border-secondary-800 border-b">
	{#if showNav}
		<div class="border-secondary-800 flex items-center gap-3 border-b px-4 py-3">
			<a
				href={listHref}
				aria-label={backAriaLabel}
				class={cn(
					interactive,
					'border-secondary-600 bg-secondary-800 hover:border-secondary-500 hover:bg-secondary-700 inline-flex size-9 shrink-0 items-center justify-center rounded-md border text-white'
				)}
			>
				<ArrowLeftIcon class="size-4" weight="duotone" />
			</a>
			<nav aria-label="Breadcrumb" class="font-heading min-w-0 text-sm font-bold">
				<ol class="flex items-center">
					<li>
						<a href={listHref} class={cn(interactive, 'text-secondary-400 hover:text-primary')}>
							{replaysLabel}
						</a>
					</li>
					<li aria-hidden="true" class="text-secondary-500 mx-2">/</li>
					<li class="min-w-0 truncate text-white">{mapName}</li>
				</ol>
			</nav>
		</div>
	{/if}
	<div
		class={cn(
			'grid grid-cols-1 gap-4',
			vote
				? 'sm:grid-cols-[minmax(220px,280px)_auto_minmax(0,1fr)]'
				: 'sm:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]'
		)}
	>
		<MapImage {map} alt={mapName} flush {resolveMapSrc} {resolveFallbackSrc} />
		{#if vote}
			<div class="flex items-start justify-center px-6 sm:px-0 sm:py-4">
				{@render vote()}
			</div>
		{/if}
		<div class="min-w-0">
			<div class={cn('px-6 py-4', vote && 'sm:pl-0')}>
				<div class="mb-3 flex min-w-0 items-center gap-3">
					{#if title}
						{@render title()}
					{:else}
						<h1 class="font-heading min-w-0 truncate text-3xl font-bold text-white">{mapName}</h1>
					{/if}
					{@render titleMeta?.()}
				</div>
				{@render details()}
				{#if showDownload || actions}
					<div class="mt-4 flex flex-wrap items-center gap-3">
						{#if showDownload}
							{#if downloadDisabled || !downloadHref}
								<Button disabled>
									<DownloadIcon class="size-4" />
									{downloadLabel}
								</Button>
							{:else}
								<Button
									href={downloadHref}
									download={downloadFileName}
									onclick={() => onDownloadClick?.()}
								>
									<DownloadIcon class="size-4" />
									{downloadLabel}
								</Button>
							{/if}
						{/if}
						{@render actions?.()}
						{#if showDownload}
							<span
								class="text-secondary-400 inline-flex h-11 items-center gap-1.5 px-3 text-sm tabular-nums"
								title={downloadsLabel}
							>
								<DownloadIcon class="size-4" weight="duotone" />
								{downloadCount}
							</span>
						{/if}
					</div>
				{/if}
				{@render afterActions?.()}
			</div>
			{#if afterDetails}
				{@render afterDetails()}
			{/if}
		</div>
	</div>
</div>
