<script lang="ts">
	import type { DocRef, DocsOverview, Faction } from '@company-of-heroes/game-data/types';
	import { FACTION_RACE_ID } from '@company-of-heroes/game-data/factions';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		controlBase,
		factionIcon,
		interactive,
		tabTrigger
	} from '@company-of-heroes/ui/variants';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import { getRaceLabel } from '../format/player-format';
	import { formatDate } from '../format/date';
	import { useHost } from '../host/host.context';
	import DocsCost from './docs-cost.svelte';
	import DocsIcon from './docs-icon.svelte';
	import DocsRefGrid from './docs-ref-grid.svelte';
	import DocsSection from './docs-section.svelte';

	type Props = {
		overview: DocsOverview;
		faction: Faction;
	};

	let { overview, faction }: Props = $props();
	const host = useHost();
	const { t } = useI18n();

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
				produces: matches(building) ? building.produces : building.produces.filter(matches)
			}))
			.filter((building) => matches(building) || building.produces.length > 0)
	);
	const structures = $derived(current.structures.filter(matches));
	const otherUnits = $derived(current.otherUnits.filter(matches));
	const commanders = $derived(current.commanders.filter(matches));
	const empty = $derived(
		!buildings.length && !structures.length && !otherUnits.length && !commanders.length
	);
</script>

<div class="border-secondary-800 border-b px-4 py-3">
	<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
		<nav class="flex flex-wrap items-center gap-1.5" aria-label={t('Factions')}>
			{#each overview.factions as entry (entry.faction)}
				{@const raceId = FACTION_RACE_ID[entry.faction]}
				<a
					href={host.href(`/docs?faction=${entry.faction}`)}
					class={cn(tabTrigger, 'inline-flex items-center gap-2')}
					data-state={entry.faction === current.faction ? 'active' : undefined}
					aria-current={entry.faction === current.faction ? 'page' : undefined}
					data-sveltekit-noscroll
				>
					<img src={host.resolve.factionFlagByRace(raceId)} alt="" class={factionIcon} />
					<span class="hidden sm:inline">{t(getRaceLabel(raceId))}</span>
				</a>
			{/each}
			<a href={host.href('/docs/weapons')} class={tabTrigger}>{t('Weapons')}</a>
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
	<p class="text-secondary-400 p-4 text-sm">{t('Nothing matches your search.')}</p>
{/if}

{#if buildings.length}
	<DocsSection title={t('Buildings and units')}>
		<div class="space-y-5">
			{#each buildings as building (building.slug)}
				<div class="grid grid-cols-1 gap-3 lg:grid-cols-[16rem_minmax(0,1fr)]">
					<a
						href={host.href(`/docs/buildings/${building.slug}`)}
						class={cn(
							interactive,
							'border-secondary-800 hover:border-secondary-600 hover:bg-secondary-900/50 flex items-center gap-3 self-start rounded-sm border p-2 transition-colors'
						)}
					>
						<DocsIcon icon={building.icon} name={building.name} />
						<span class="min-w-0">
							<span class="block truncate text-sm font-semibold text-white">{building.name}</span>
							<DocsCost cost={building.cost} compact class="text-secondary-300" />
						</span>
					</a>
					{#if building.produces.length}
						<DocsRefGrid refs={building.produces} />
					{/if}
				</div>
			{/each}
		</div>
	</DocsSection>
{/if}

{#if structures.length}
	<DocsSection title={t('Structures and defenses')}>
		<DocsRefGrid refs={structures} />
	</DocsSection>
{/if}

{#if otherUnits.length}
	<DocsSection title={t('Call-ins and other units')}>
		<DocsRefGrid refs={otherUnits} />
	</DocsSection>
{/if}

{#if commanders.length}
	<DocsSection title={t('Commanders')}>
		<DocsRefGrid refs={commanders} showCost={false} />
	</DocsSection>
{/if}

<p class="text-secondary-500 px-4 py-3 text-xs">
	{t('Stats come from the game files (build of {date}). Tips are written by staff.', {
		date: formatDate(overview.meta.gameBuild, host.locale())
	})}
</p>
