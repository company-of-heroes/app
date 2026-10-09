<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import DocsHeader from './docs-header.svelte';
	import DocsLayout from './docs-layout.svelte';
	import DocsNote from './docs-note.svelte';
	import { accentBlock } from '@company-of-heroes/ui/variants';
	import DocsRefGrid from './docs-ref-grid.svelte';
	import DocsRefRow from './docs-ref-row.svelte';
	import DocsSection from './docs-section.svelte';
	import DocsWeaponStats from './docs-weapon-stats.svelte';
	import type { DocsWeaponPageData } from './types';

	type Props = {
		page: DocsWeaponPageData;
	};

	let { page }: Props = $props();
	const { t } = useI18n();
	const unitCount = (count: number) => (count === 1 ? t('1 unit') : t('{count} units', { count }));

	const weapon = $derived(page.weapon);
</script>

<DocsHeader
	name={weapon.name}
	icon={weapon.icon}
	kicker={t('Weapon')}
	parent={{ label: t('Weapons'), href: '/wiki/weapons' }}
/>

<DocsLayout>
	{#snippet main()}
		<DocsSection title={t('Stats')}>
			<DocsWeaponStats {weapon} showTargets />
			<p class="text-secondary-500 border-secondary-800 border-t px-4 py-3 text-xs">
				{t('Target multipliers that are 1 (no change) are left out.')}
			</p>
		</DocsSection>
	{/snippet}
	{#snippet side()}
		{#key weapon.slug}
			<DocsNote kind="weapon" slug={weapon.slug} note={page.note} />
		{/key}
		{#if page.upgradeFor.length}
			<!-- Upgrade weapons: the upgrade (hover for its stats popover), then who can buy it. -->
			<DocsSection
				title={t('Upgrade for')}
				note={unitCount(page.upgradeFor.reduce((total, entry) => total + entry.units.length, 0))}
			>
				{#each page.upgradeFor as entry (entry.upgrade.slug)}
					<div class={accentBlock}>
						<DocsRefRow ref={entry.upgrade} note={t('Upgrade')} compact accent />
					</div>
					{#if entry.units.length}
						<DocsRefGrid refs={entry.units} class="sm:grid-cols-1 xl:grid-cols-1" />
					{/if}
				{/each}
			</DocsSection>
		{/if}
		{#if page.firedBy.length}
			<!-- Ability weapons (grenades, satchels, off-map strikes): the ability, then who has it. -->
			<DocsSection title={t('Fired by ability')}>
				{#each page.firedBy as entry (entry.ability.slug)}
					<div class={accentBlock}>
						<DocsRefRow ref={entry.ability} note={t('Ability')} compact accent />
					</div>
					<DocsRefGrid refs={entry.units} class="sm:grid-cols-1 xl:grid-cols-1" />
				{/each}
			</DocsSection>
		{/if}
		{#if page.usedBy.length}
			<DocsSection title={t('Used by')} note={unitCount(page.usedBy.length)}>
				<DocsRefGrid refs={page.usedBy} class="sm:grid-cols-1 xl:grid-cols-1" />
			</DocsSection>
		{/if}
	{/snippet}
</DocsLayout>
