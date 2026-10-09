<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import HeartIcon from 'phosphor-svelte/lib/HeartIcon';
	import { useHost } from '../host/host.context';
	import StatChip from '../replay/stat-chip.svelte';
	import DocsEntryList from './docs-entry-list.svelte';
	import DocsHeader from './docs-header.svelte';
	import DocsNote from './docs-note.svelte';
	import DocsRefGrid from './docs-ref-grid.svelte';
	import DocsSection from './docs-section.svelte';
	import DocsLayout from './docs-layout.svelte';
	import DocsWeaponBlock from './docs-weapon-block.svelte';
	import { formatNumber } from './format';
	import type { DocsBuildingPageData } from './types';

	type Props = {
		page: DocsBuildingPageData;
	};

	let { page }: Props = $props();
	const host = useHost();
	const { t } = useI18n();
	const unitCount = (count: number) => (count === 1 ? t('1 unit') : t('{count} units', { count }));

	const building = $derived(page.building);
	// The side column only when it has something: a tip (or staff who can write one) or research.
	const hasSide = $derived(
		Boolean(page.note || (host.auth.user?.isStaff && host.api.docs) || page.research.length)
	);
</script>

<DocsHeader
	name={building.name}
	icon={building.icon}
	faction={building.faction}
	kicker={t('Building')}
	help={building.help}
	extra={building.extra}
	cost={building.cost}
>
	{#if building.hitpoints}
		<div class="mt-3 flex flex-wrap gap-1.5">
			<StatChip
				icon={HeartIcon}
				name={t('Health')}
				value={formatNumber(building.hitpoints, 0)}
				iconClass="text-red-300"
			/>
		</div>
	{/if}
</DocsHeader>

{#snippet main()}
	{#if page.builtBy.length}
		<DocsSection title={t('Built by')}>
			<DocsRefGrid refs={page.builtBy} />
		</DocsSection>
	{/if}
	{#if page.requires.length}
		<DocsSection title={t('Requires')}>
			<DocsRefGrid refs={page.requires} note={t('Upgrade')} />
		</DocsSection>
	{/if}
	{#each page.requiresBuildings as group, index (index)}
		<DocsSection
			title={t('Requires')}
			note={group.length > 1 ? t('One of these buildings') : undefined}
		>
			<DocsRefGrid refs={group} />
		</DocsSection>
	{/each}
	{#each page.unlockedBy as unlock (`${unlock.commander.slug}:${unlock.tier.slug}`)}
		<DocsSection title={t('Unlocked by')}>
			<DocsRefGrid refs={[unlock.commander]} note={unlock.tier.name} />
		</DocsSection>
	{/each}
	{#if page.crew.length}
		<!-- British emplacements: the gun squad that mans it once built. -->
		<DocsSection title={t('Gun crew')}>
			<DocsRefGrid refs={page.crew} />
		</DocsSection>
	{/if}
	{#if page.produces.length}
		<DocsSection title={t('Produces')} note={unitCount(page.produces.length)}>
			<DocsRefGrid refs={page.produces} class="xl:grid-cols-2" />
		</DocsSection>
	{/if}
	{#if page.abilities.length}
		<DocsSection title={t('Abilities')}>
			<DocsEntryList entries={page.abilities} faction={building.faction} />
		</DocsSection>
	{/if}
	{#if page.weapons.length}
		<DocsSection title={t('Weapons')}>
			<div class="divide-secondary-800 divide-y">
				{#each page.weapons as weapon (weapon.slug)}
					<DocsWeaponBlock {weapon} />
				{/each}
			</div>
		</DocsSection>
	{/if}
{/snippet}

{#snippet side()}
	{#key building.slug}
		<DocsNote kind="building" slug={building.slug} note={page.note} />
	{/key}
	{#if page.research.length}
		<DocsSection title={t('Research')}>
			<DocsEntryList entries={page.research} faction={building.faction} />
		</DocsSection>
	{/if}
{/snippet}

<DocsLayout {main} side={hasSide ? side : undefined} />
