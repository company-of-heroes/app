<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { accentBlock } from '@company-of-heroes/ui/variants';
	import EffectRows from '../replay/effect-rows.svelte';
	import DocsHeader from './docs-header.svelte';
	import DocsLayout from './docs-layout.svelte';
	import DocsNote from './docs-note.svelte';
	import DocsRefGrid from './docs-ref-grid.svelte';
	import DocsRefRow from './docs-ref-row.svelte';
	import DocsSection from './docs-section.svelte';
	import type { DocsUpgradePageData } from './types';

	type Props = {
		page: DocsUpgradePageData;
	};

	let { page }: Props = $props();
	const { t } = useI18n();

	const upgrade = $derived(page.upgrade);
	const unitCount = (count: number) => (count === 1 ? t('1 unit') : t('{count} units', { count }));
	const faction = $derived(upgrade.factions.length === 1 ? upgrade.factions[0] : undefined);
	const unlocks = $derived(
		[
			{ key: 'units', title: t('Unlocks units'), refs: page.unlocks.units },
			{ key: 'buildings', title: t('Unlocks buildings'), refs: page.unlocks.buildings },
			{ key: 'abilities', title: t('Unlocks abilities'), refs: page.unlocks.abilities },
			{ key: 'upgrades', title: t('Unlocks upgrades'), refs: page.unlocks.upgrades }
		].filter((group) => group.refs.length)
	);
</script>

<DocsHeader
	name={upgrade.name}
	icon={upgrade.icon}
	{faction}
	kicker={t('Upgrade')}
	help={upgrade.help}
	extra={upgrade.extra}
	cost={upgrade.cost}
/>

<DocsLayout>
	{#snippet main()}
		{#if upgrade.effects?.length}
			<DocsSection title={t('Effects')} padded>
				<EffectRows effects={upgrade.effects} inline class="text-sm leading-snug" />
			</DocsSection>
		{/if}
		{#if upgrade.weaponRefs.length}
			<DocsSection title={t('Weapons added')}>
				<DocsRefGrid refs={upgrade.weaponRefs} note={t('Weapon')} />
			</DocsSection>
		{/if}
		{#each unlocks as group (group.key)}
			<DocsSection title={group.title}>
				<DocsRefGrid refs={group.refs} />
			</DocsSection>
		{/each}
		{#if !upgrade.effects?.length && !upgrade.weaponRefs.length && !unlocks.length}
			<p class="text-secondary-400 px-4 py-3 text-sm">
				{t('The game files list no effects for this upgrade.')}
			</p>
		{/if}
	{/snippet}
	{#snippet side()}
		{#key upgrade.slug}
			<DocsNote kind="upgrade" slug={upgrade.slug} note={page.note} />
		{/key}
		{#if page.commanderTier}
			<DocsSection title={t('Doctrine')}>
				<div class={accentBlock}>
					<DocsRefRow
						ref={page.commanderTier.commander}
						note={t('Tier {tier}', { tier: page.commanderTier.tier + 1 })}
						compact
						accent
					/>
				</div>
			</DocsSection>
		{/if}
		{#if page.availableOn.length}
			<DocsSection title={t('Available on')} note={unitCount(page.availableOn.length)}>
				<DocsRefGrid refs={page.availableOn} class="sm:grid-cols-1 xl:grid-cols-1" />
			</DocsSection>
		{/if}
		{#if page.researchedAt.length}
			<DocsSection title={t('Researched at')}>
				<DocsRefGrid refs={page.researchedAt} class="sm:grid-cols-1 xl:grid-cols-1" />
			</DocsSection>
		{/if}
		{#if page.appliesTo.length}
			<DocsSection title={t('Applies to')} note={unitCount(page.appliesTo.length)}>
				<DocsRefGrid refs={page.appliesTo} class="sm:grid-cols-1 xl:grid-cols-1" />
			</DocsSection>
		{/if}
		{#if page.requires.length || page.requiresBuildings.length}
			<DocsSection title={t('Requires')}>
				{#if page.requires.length}
					<DocsRefGrid
						refs={page.requires}
						note={t('Upgrade')}
						class="sm:grid-cols-1 xl:grid-cols-1"
					/>
				{/if}
				{#each page.requiresBuildings as group, index (index)}
					<DocsRefGrid refs={group} note={t('Building')} class="sm:grid-cols-1 xl:grid-cols-1" />
				{/each}
			</DocsSection>
		{/if}
		{#if upgrade.excludedRefs.length}
			<DocsSection title={t('Not with')}>
				<DocsRefGrid
					refs={upgrade.excludedRefs}
					note={t('Upgrade')}
					class="sm:grid-cols-1 xl:grid-cols-1"
				/>
			</DocsSection>
		{/if}
	{/snippet}
</DocsLayout>
