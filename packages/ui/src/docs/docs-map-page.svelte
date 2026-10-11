<script lang="ts">
	import type { MapMode } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { pageTab } from '@company-of-heroes/ui/variants';
	import { Badge } from '../ui/badge';
	import DocsCost from './docs-cost.svelte';
	import DocsHeader from './docs-header.svelte';
	import DocsIcon from './docs-icon.svelte';
	import DocsLayout from './docs-layout.svelte';
	import DocsMapBoard from './docs-map-board.svelte';
	import DocsNote from './docs-note.svelte';
	import DocsSection from './docs-section.svelte';
	import { mapPointKey } from './format';
	import type { DocsMapImage, DocsMapPageData } from './types';

	type Props = {
		page: DocsMapPageData;
		image: DocsMapImage;
	};

	let { page, image }: Props = $props();
	const { t } = useI18n();

	const MODE_LABELS: Record<MapMode, string> = {
		classic: 'Map',
		assault: 'Operation: Assault',
		panzerkrieg: 'Operation: Panzerkrieg',
		stonewall: 'Operation: Stonewall'
	};

	let showSectors = $state(true);
	let showPoints = $state(true);
	let showIncome = $state(true);
	let showStarts = $state(true);
	let highlight = $state<string | null>(null);

	const map = $derived(page.map);
	const layers = $derived([
		{ label: t('Points'), on: showPoints, toggle: () => (showPoints = !showPoints) },
		{ label: t('Income'), on: showIncome, toggle: () => (showIncome = !showIncome) },
		{ label: t('Sectors'), on: showSectors, toggle: () => (showSectors = !showSectors) },
		...(map.starts.length && !map.startMarkers.length
			? [
					{
						label: t('Starting positions'),
						on: showStarts,
						toggle: () => (showStarts = !showStarts)
					}
				]
			: [])
	]);
	const income = $derived({ fuel: page.income.fuel, munition: page.income.munition });
</script>

<DocsHeader
	name={map.name}
	image={image(map.slug, 'thumb')}
	kicker="{t(MODE_LABELS[map.mode])} · {t('{count} players', { count: map.players })}"
	parent={{ label: t('Maps'), href: '/wiki/maps' }}
>
	<div class="mt-3 flex flex-wrap items-center gap-1.5">
		<Badge variant="default">{map.size.width} × {map.size.height} m</Badge>
		<Badge variant="default">{t('{count} sectors', { count: map.sectors })}</Badge>
		{#if map.community}
			<Badge variant="info">{t('Community map')}</Badge>
		{/if}
	</div>
	{#if map.description}
		<p class="text-secondary-300 mt-3 max-w-3xl text-sm leading-relaxed whitespace-pre-line">
			{map.description}
		</p>
	{/if}
</DocsHeader>

{#snippet main()}
	<DocsSection title={t('Map')}>
		<div class="flex flex-wrap items-center gap-1.5 px-4 py-3">
			{#each layers as layer (layer.label)}
				<button
					type="button"
					class={pageTab}
					data-state={layer.on ? 'on' : undefined}
					aria-pressed={layer.on}
					onclick={layer.toggle}
				>
					{layer.label}
				</button>
			{/each}
		</div>
		<div class="px-4 pb-4">
			<DocsMapBoard
				{map}
				pointTypes={page.pointTypes}
				src={image(map.slug, 'full')}
				sectorsSrc={image(map.slug, 'sectors')}
				sectorIdsSrc={image(map.slug, 'sector-ids')}
				{showSectors}
				{showPoints}
				{showIncome}
				{showStarts}
				{highlight}
			/>
		</div>
	</DocsSection>
{/snippet}

{#snippet side()}
	{#key map.slug}
		<DocsNote kind="map" slug={map.slug} note={page.note} />
	{/key}
	{#if page.counts.length}
		<DocsSection title={t('Points')} note={t('Per minute while held')}>
			<!-- Hovering a kind picks out its points on the map. -->
			<ul class="-mb-px">
				{#each page.counts as kind (mapPointKey(kind))}
					<li
						class={cn(
							'border-secondary-800 flex items-center gap-3 border-b px-4 py-2.5 transition-colors',
							highlight === mapPointKey(kind) && 'bg-secondary-950/60'
						)}
						onpointerenter={() => (highlight = mapPointKey(kind))}
						onpointerleave={() => (highlight = null)}
					>
						<DocsIcon icon={kind.icon ?? undefined} name={kind.name} class="size-7" />
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-semibold text-white">
								<span class="tabular-nums">{kind.count}×</span>
								{kind.name}
							</p>
							<p class="text-secondary-500 text-xs">
								{t('Capture {seconds}s', { seconds: kind.captureTime })}
							</p>
						</div>
						<DocsCost cost={kind.income} class="shrink-0 justify-end" />
					</li>
				{/each}
			</ul>
		</DocsSection>
	{/if}
	{#if income.fuel || income.munition}
		<DocsSection title={t('All points held')} note={t('Per minute')} padded>
			<DocsCost cost={income} />
		</DocsSection>
	{/if}
{/snippet}

<DocsLayout {main} {side} />
