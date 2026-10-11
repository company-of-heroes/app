<script lang="ts">
	import type { DocMapRow } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		controlBase,
		flushHeader,
		flushHeaderTitle,
		interactive
	} from '@company-of-heroes/ui/variants';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import { useHost } from '../host/host.context';
	import { Badge } from '../ui/badge';
	import { ToggleGroup } from '../ui/toggle-group';
	import DocsBreadcrumb from './docs-breadcrumb.svelte';
	import DocsCost from './docs-cost.svelte';
	import type { DocsMapImage } from './types';

	type Props = {
		maps: DocMapRow[];
		image: DocsMapImage;
	};

	let { maps, image }: Props = $props();
	const host = useHost();
	const { t } = useI18n();

	let search = $state('');
	let size = $state('all');

	const sizes = $derived([
		{ value: 'all', label: t('All') },
		...[2, 4, 6, 8].map((players) => ({
			value: String(players),
			label: t('{count} players', { count: players })
		})),
		{ value: 'operations', label: t('Operations') }
	]);
	const query = $derived(search.trim().toLowerCase());
	const filtered = $derived(
		maps.filter(
			(map) =>
				(size === 'all' ||
					(size === 'operations'
						? map.mode !== 'classic'
						: map.mode === 'classic' && String(map.players) === size)) &&
				(!query || map.name.toLowerCase().includes(query))
		)
	);
</script>

<DocsBreadcrumb current={t('Maps')} />

<div class="border-secondary-800 border-b px-4 py-6">
	<h1 class="font-heading text-3xl font-bold text-white">{t('Maps')}</h1>
	<p class="text-secondary-400 mt-2 max-w-3xl text-sm leading-relaxed">
		{t(
			'Every map that ships with the game: victory points, resource points, territory sectors and starting positions from the map files.'
		)}
	</p>
	<p class="text-secondary-500 mt-1 text-xs">
		{t('Fuel and munitions per minute with every point held.')}
	</p>
	<div class="mt-5 flex flex-wrap items-center justify-between gap-3">
		<ToggleGroup bind:value={size} items={sizes} variant="tabs" aria-label={t('Players')} />
		<label class={cn(controlBase, 'flex w-full items-center sm:w-58')}>
			<MagnifyingGlassIcon class="text-secondary-500 ml-3 size-4 shrink-0" />
			<input
				type="search"
				placeholder={t('Search maps...')}
				bind:value={search}
				class="placeholder:text-secondary-500 min-w-0 flex-1 bg-transparent px-3 text-sm text-white focus:outline-none"
			/>
		</label>
	</div>
</div>

<section>
	<div class={cn(flushHeader, 'flex items-baseline justify-between gap-3')}>
		<h2 class={flushHeaderTitle}>{t('Maps')}</h2>
		<p class="text-secondary-500 text-xs">{t('{count} maps', { count: filtered.length })}</p>
	</div>
	{#if filtered.length}
		<!-- Grid cells draw their own right and bottom line; the wrapper clips the right edge and
		sits a pixel over the footer's top border. -->
		<div class="-mb-px overflow-hidden">
			<ul class="-mr-px grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
				{#each filtered as map (map.slug)}
					{@const src = image(map.slug, 'thumb')}
					<li class="border-secondary-800 min-w-0 border-r border-b">
						<a
							href={host.href(`/wiki/maps/${map.slug}`)}
							class={cn(
								interactive,
								'group hover:bg-secondary-950/60 flex gap-4 p-4 transition-colors'
							)}
						>
							<div class="size-24 shrink-0 overflow-hidden rounded-sm bg-gray-950">
								{#if src}
									<img
										{src}
										alt=""
										loading="lazy"
										class="size-full object-contain transition-transform duration-300 group-hover:scale-105"
									/>
								{/if}
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate font-semibold text-white group-hover:underline">{map.name}</p>
								<p class="text-secondary-400 mt-0.5 text-xs">
									{t('{count} players', { count: map.players })}
									<span class="text-secondary-600">·</span>
									{t('{count} victory points', { count: map.victoryPoints })}
								</p>
								<DocsCost
									cost={{ fuel: map.income.fuel, munition: map.income.munition }}
									class="mt-2"
								/>
								{#if map.community}
									<Badge variant="info" class="mt-2">{t('Community map')}</Badge>
								{/if}
							</div>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{:else}
		<p class="text-secondary-400 px-4 py-6 text-sm">{t('Nothing matches your search.')}</p>
	{/if}
</section>
