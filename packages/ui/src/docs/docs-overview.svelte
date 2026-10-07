<script lang="ts">
	import type { DocRef, DocsOverview, Faction } from '@company-of-heroes/game-data/types';
	import { FACTION_RACE_ID } from '@company-of-heroes/game-data/factions';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		accentBlock,
		accentBlockLabel,
		controlBase,
		factionIcon,
		flushHeader,
		flushHeaderTitle,
		interactive,
		pageTab,
		tableHeadText
	} from '@company-of-heroes/ui/variants';
	import ArrowFatLinesUpIcon from 'phosphor-svelte/lib/ArrowFatLinesUpIcon';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import { getRaceLabel } from '../format/player-format';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import DocsIcon from './docs-icon.svelte';
	import StatisticsInfoPopover from '../statistics/statistics-info-popover.svelte';
	import DocsDoctrineRow from './docs-doctrine-row.svelte';
	import { createDocsPopover } from './docs-popover.context';
	import DocsRefGrid from './docs-ref-grid.svelte';
	import DocsRefRow from './docs-ref-row.svelte';
	import DocsReportButton from './docs-report-button.svelte';
	import { docsPath } from './format';

	type Props = {
		overview: DocsOverview;
		faction: Faction;
	};

	let { overview, faction }: Props = $props();
	const host = useHost();
	const { t } = useI18n();
	const popover = createDocsPopover();

	let search = $state('');

	const current = $derived(
		overview.factions.find((entry) => entry.faction === faction) ?? overview.factions[0]
	);
	const query = $derived(search.trim().toLowerCase());
	const matches = (ref: DocRef) => !query || ref.name.toLowerCase().includes(query);
	const buildings = $derived(
		current.buildings
			.map((building) => ({
				...building,
				produces: matches(building) ? building.produces : building.produces.filter(matches),
				research: matches(building) ? building.research : building.research.filter(matches)
			}))
			.filter(
				(building) =>
					matches(building) || building.produces.length > 0 || building.research.length > 0
			)
	);
	const techTree = $derived(buildings.filter((building) => building.tier));
	const otherProducers = $derived(buildings.filter((building) => !building.tier));
	const structures = $derived(current.structures.filter(matches));
	const otherUnits = $derived(current.otherUnits.filter(matches));
	const commanders = $derived(current.commanders.filter(matches));
	const empty = $derived(
		!buildings.length && !structures.length && !otherUnits.length && !commanders.length
	);
</script>

<div class="border-secondary-800 border-b px-4 py-6">
	<div class="flex items-start justify-between gap-3">
		<h1 class="font-heading text-3xl font-bold text-white">{t('Wiki')}</h1>
		<DocsReportButton page={t('Wiki')} class="shrink-0" />
	</div>
	<p class="text-secondary-400 mt-2 max-w-3xl text-sm leading-relaxed">
		{t(
			'Every unit, building, doctrine and weapon with its stats from the game files, plus tips from staff on when to use it.'
		)}
	</p>
	<div class="mt-5 flex flex-wrap items-center justify-between gap-3">
		<nav class="flex flex-wrap items-center gap-1.5" aria-label={t('Factions')}>
			{#each overview.factions as entry (entry.faction)}
				{@const raceId = FACTION_RACE_ID[entry.faction]}
				<a
					href={host.href(`/wiki?faction=${entry.faction}`)}
					class={pageTab}
					data-state={entry.faction === current.faction ? 'on' : undefined}
					aria-current={entry.faction === current.faction ? 'page' : undefined}
					data-sveltekit-noscroll
				>
					<img src={host.resolve.factionFlagByRace(raceId)} alt="" class={factionIcon} />
					<span class="hidden sm:inline">{t(getRaceLabel(raceId))}</span>
				</a>
			{/each}
			<a href={host.href('/wiki/weapons')} class={pageTab}>{t('Weapons')}</a>
		</nav>
		<label class={cn(controlBase, 'flex w-full items-center sm:w-58')}>
			<MagnifyingGlassIcon class="text-secondary-500 ml-3 size-4 shrink-0" />
			<input
				type="search"
				placeholder={t('Search units, buildings...')}
				bind:value={search}
				class="placeholder:text-secondary-500 min-w-0 flex-1 bg-transparent px-3 text-sm text-white focus:outline-none"
			/>
		</label>
	</div>
</div>

{#if empty}
	<p class="text-secondary-400 border-secondary-800 border-b px-4 py-6 text-sm">
		{t('Nothing matches your search.')}
	</p>
{:else}
	{#if commanders.length}
		<!-- The doctrines side by side, with their in-game banners. -->
		<section class="border-secondary-800 border-b">
			{@render panelHeader(t('Doctrines'))}
			<div class="bg-secondary-800 grid gap-px sm:grid-cols-3">
				{#each commanders as commander (commander.slug)}
					<DocsDoctrineRow {commander} note={t('Doctrine')} large />
				{/each}
			</div>
		</section>
	{/if}

	{#if techTree.length}
		<!-- The tech tree left to right, HQ first. -->
		<section class="border-secondary-800 border-b">
			{@render panelHeader(
				t('Buildings and units'),
				t('{count} buildings', { count: techTree.length })
			)}
			{@render columns(techTree)}
		</section>
	{/if}

	{#if otherProducers.length}
		<!-- Producers outside the tech tree (bunkers, doctrine gliders) get their own row. -->
		<section class="border-secondary-800 border-b">
			{@render panelHeader(t('Other buildings'))}
			{@render columns(otherProducers)}
		</section>
	{/if}

	{#if otherUnits.length || structures.length}
		<div
			class="border-secondary-800 divide-secondary-800 grid divide-y border-b lg:grid-cols-2 lg:divide-x lg:divide-y-0"
		>
			{#if otherUnits.length}
				<section class="min-w-0">
					{@render panelHeader(t('Call-ins and other units'))}
					<DocsRefGrid refs={otherUnits} class="xl:grid-cols-2" />
				</section>
			{/if}
			{#if structures.length}
				<section class="min-w-0">
					{@render panelHeader(t('Structures and defenses'))}
					<DocsRefGrid refs={structures} class="xl:grid-cols-2" />
				</section>
			{/if}
		</div>
	{/if}
{/if}

{#snippet columns(list: typeof buildings)}
	<!-- One column per building, like the unit lists on /stats. Each column draws its right and
	bottom line; the wrapper clips the outer ones so a short row leaves no grey cells. -->
	<div class="-mb-px overflow-hidden">
		<div
			class="-mr-px grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(var(--columns),minmax(0,1fr))]"
			style:--columns={Math.max(Math.min(techTree.length, 6), 1)}
		>
			{#each list as building (building.slug)}
				<section class="border-secondary-800 min-w-0 border-r">
					<a
						href={host.href(docsPath(building) ?? '/wiki')}
						class={cn(
							interactive,
							'bg-secondary-950/90 hover:bg-secondary-900/60 border-secondary-800 flex items-center gap-3 border-b px-4 py-3 transition-colors'
						)}
					>
						<DocsIcon icon={building.icon} name={building.name} class="size-9" />
						<span class="min-w-0">
							{#if building.tier}
								<span class={cn(tableHeadText, 'text-primary block text-[11px]')}>
									{building.tier}
								</span>
							{/if}
							<span class="block truncate text-sm font-semibold text-white">
								{building.name}
							</span>
						</span>
					</a>
					<ol>
						{#each building.produces as unit (unit.slug)}
							<li class="border-secondary-800 border-b">
								<DocsRefRow ref={unit} />
							</li>
						{/each}
					</ol>
					{#if building.research.length}
						<!-- Research sits apart from the units: a darker block with its own accent label. -->
						<div class={accentBlock}>
							<p class={accentBlockLabel}>
								<ArrowFatLinesUpIcon class="size-3.5" weight="fill" />
								{t('Upgrades')}
							</p>
							<ol>
								{#each building.research as upgrade (upgrade.slug)}
									<li class="border-secondary-800 border-b">
										<DocsRefRow ref={upgrade} compact accent />
									</li>
								{/each}
							</ol>
						</div>
					{/if}
				</section>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet panelHeader(title: string, note?: string)}
	<div class={cn(flushHeader, 'flex items-baseline justify-between gap-3')}>
		<h2 class={flushHeaderTitle}>{title}</h2>
		{#if note}
			<p class="text-secondary-500 text-xs">{note}</p>
		{/if}
	</div>
{/snippet}

<p class="text-secondary-500 px-4 py-3 text-xs">
	{t('Stats come from the game files (build of {date}). Tips are written by staff.', {
		date: formatDate(overview.meta.gameBuild, host.locale())
	})}
</p>

<StatisticsInfoPopover {popover} />
