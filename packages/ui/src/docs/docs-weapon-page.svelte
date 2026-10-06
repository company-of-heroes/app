<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import DocsHeader from './docs-header.svelte';
	import DocsNote from './docs-note.svelte';
	import DocsRefGrid from './docs-ref-grid.svelte';
	import DocsSection from './docs-section.svelte';
	import DocsWeaponStats from './docs-weapon-stats.svelte';
	import type { DocsWeaponPageData } from './types';

	type Props = {
		page: DocsWeaponPageData;
	};

	let { page }: Props = $props();
	const { t } = useI18n();

	const weapon = $derived(page.weapon);
</script>

<DocsHeader name={weapon.name} icon={weapon.icon} kicker={t('Weapon')} />

{#key weapon.slug}
	<DocsNote kind="weapon" slug={weapon.slug} note={page.note} />
{/key}

<DocsSection title={t('Stats')}>
	<DocsWeaponStats {weapon} showTargets />
	<p class="text-secondary-500 mt-4 text-xs">
		{t('Target multipliers that are 1 (no change) are left out.')}
	</p>
</DocsSection>

{#if page.usedBy.length}
	<DocsSection title={t('Used by')}>
		<DocsRefGrid refs={page.usedBy} />
	</DocsSection>
{/if}
