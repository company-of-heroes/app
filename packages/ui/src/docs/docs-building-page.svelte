<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import * as List from '../ui/list';
	import DocsEntryList from './docs-entry-list.svelte';
	import DocsHeader from './docs-header.svelte';
	import DocsNote from './docs-note.svelte';
	import DocsRefGrid from './docs-ref-grid.svelte';
	import DocsSection from './docs-section.svelte';
	import DocsWeaponStats from './docs-weapon-stats.svelte';
	import { formatNumber } from './format';
	import type { DocsBuildingPageData } from './types';

	type Props = {
		page: DocsBuildingPageData;
	};

	let { page }: Props = $props();
	const host = useHost();
	const { t } = useI18n();

	const building = $derived(page.building);
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
		<List.Root class="mt-4 grid-cols-[9rem_minmax(0,1fr)] gap-x-4">
			<List.Title>{t('Health')}</List.Title>
			<List.Value>{formatNumber(building.hitpoints, 0)}</List.Value>
		</List.Root>
	{/if}
</DocsHeader>

{#key building.slug}
	<DocsNote kind="building" slug={building.slug} note={page.note} />
{/key}

{#if page.produces.length}
	<DocsSection title={t('Produces')}>
		<DocsRefGrid refs={page.produces} />
	</DocsSection>
{/if}

{#if page.research.length}
	<DocsSection title={t('Research')}>
		<DocsEntryList entries={page.research} />
	</DocsSection>
{/if}

{#if page.abilities.length}
	<DocsSection title={t('Abilities')}>
		<DocsEntryList entries={page.abilities} />
	</DocsSection>
{/if}

{#if page.weapons.length}
	<DocsSection title={t('Weapons')}>
		<div class="space-y-6">
			{#each page.weapons as weapon (weapon.slug)}
				<div>
					<a
						href={host.href(`/docs/weapons/${weapon.slug}`)}
						class={cn(interactive, 'hover:text-primary mb-3 inline-block font-semibold text-white')}
					>
						{weapon.name}
					</a>
					<DocsWeaponStats {weapon} />
				</div>
			{/each}
		</div>
	</DocsSection>
{/if}
