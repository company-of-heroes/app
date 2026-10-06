<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import { useHost } from '../host/host.context';
	import * as List from '../ui/list';
	import DocsCost from './docs-cost.svelte';
	import DocsEntryList from './docs-entry-list.svelte';
	import DocsHeader from './docs-header.svelte';
	import DocsNote from './docs-note.svelte';
	import DocsSection from './docs-section.svelte';
	import DocsVeterancy from './docs-veterancy.svelte';
	import DocsWeaponStats from './docs-weapon-stats.svelte';
	import { docsPath, formatNumber, targetTypeLabel } from './format';
	import type { DocsUnitPageData } from './types';

	type Props = {
		page: DocsUnitPageData;
	};

	let { page }: Props = $props();
	const host = useHost();
	const { t } = useI18n();

	const unit = $derived(page.unit);
	const RATINGS = [
		{ key: 'infantry', label: 'Infantry' },
		{ key: 'lightarmor', label: 'Light vehicles' },
		{ key: 'heavyarmor', label: 'Tanks' },
		{ key: 'structures', label: 'Structures' }
	];
	const ratings = $derived(RATINGS.filter((rating) => unit.ratings?.[rating.key]));
	const metaList = 'grid-cols-[9rem_minmax(0,1fr)] content-start gap-x-4';
</script>

<DocsHeader
	name={unit.name}
	icon={unit.icon}
	faction={unit.faction}
	kicker={unit.kind === 'vehicles' ? t('Vehicle') : t('Infantry')}
	help={unit.help}
	extra={unit.extra}
	cost={unit.cost}
	pop={unit.pop}
/>

<div class="border-secondary-800 grid grid-cols-1 gap-6 border-b p-4 lg:grid-cols-2">
	<div class="space-y-4">
		<List.Root class={metaList}>
			{#if unit.size}
				<List.Title>{t('Squad size')}</List.Title>
				<List.Value>{unit.size}</List.Value>
			{/if}
			{#if unit.reinforce && Object.keys(unit.reinforce).length}
				<List.Title>{t('Reinforce')}</List.Title>
				<List.Value><DocsCost cost={unit.reinforce} compact /></List.Value>
			{/if}
			{#if page.producedBy.length}
				<List.Title>{t('Built at')}</List.Title>
				<List.Value class="flex flex-wrap gap-x-3">
					{#each page.producedBy as producer (producer.slug)}
						{@const path = docsPath(producer)}
						{#if path}
							<a href={host.href(path)} class={cn(interactive, 'text-primary hover:underline')}
								>{producer.name}</a
							>
						{:else}
							<span>{producer.name}</span>
						{/if}
					{/each}
				</List.Value>
			{/if}
			{#each page.calledInBy as callIn (`${callIn.commander.slug}:${callIn.tier.slug}`)}
				<List.Title>{t('Call-in')}</List.Title>
				<List.Value>
					<a
						href={host.href(docsPath(callIn.commander) ?? '/docs')}
						class={cn(interactive, 'text-primary hover:underline')}
					>
						{callIn.commander.name}
					</a>
					<span class="text-secondary-400">· {callIn.tier.name}</span>
					{#if callIn.ability?.cost}
						<DocsCost cost={callIn.ability.cost} compact class="ml-1" />
					{/if}
				</List.Value>
			{/each}
		</List.Root>

		{#if ratings.length}
			<div>
				<h3 class="text-secondary-400 mb-2 text-xs font-semibold tracking-wider uppercase">
					{t('Effective against')}
				</h3>
				<ul class="space-y-1.5">
					{#each ratings as rating (rating.key)}
						{@const value = unit.ratings?.[rating.key] ?? 0}
						<li class="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-x-4 text-sm">
							<span class="text-secondary-300">{t(rating.label)}</span>
							<span class="flex gap-1" aria-label={t('{value} out of 5', { value })}>
								{#each [1, 2, 3, 4, 5] as step (step)}
									<span
										class={cn(
											'h-2 w-6 rounded-xs',
											step <= value ? 'bg-primary' : 'bg-secondary-800'
										)}
									></span>
								{/each}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	<div class="space-y-3">
		{#each unit.models ?? [] as model (model.slug)}
			<div class="border-secondary-800 rounded-sm border p-3">
				<p class="mb-2 text-sm font-semibold text-white">
					{model.count}× {model.name ?? targetTypeLabel(model.slug)}
				</p>
				<List.Root class={metaList}>
					{#if model.targetType}
						<List.Title>{t('Armor type')}</List.Title>
						<List.Value>{targetTypeLabel(model.targetType)}</List.Value>
					{/if}
					{#if model.hitpoints}
						<List.Title>{t('Health')}</List.Title>
						<List.Value>{formatNumber(model.hitpoints, 0)}</List.Value>
					{/if}
					{#if model.speed}
						<List.Title>{t('Top speed')}</List.Title>
						<List.Value>{formatNumber(model.speed)}</List.Value>
					{/if}
					{#if model.sight}
						<List.Title>{t('Sight')}</List.Title>
						<List.Value>{formatNumber(model.sight, 0)}</List.Value>
					{/if}
				</List.Root>
			</div>
		{/each}
	</div>
</div>

{#key unit.slug}
	<DocsNote kind="unit" slug={unit.slug} note={page.note} />
{/key}

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

{#if page.abilities.length}
	<DocsSection title={t('Abilities')}>
		<DocsEntryList entries={page.abilities} />
	</DocsSection>
{/if}

{#if page.upgrades.length}
	<DocsSection title={t('Upgrades')}>
		<DocsEntryList entries={page.upgrades} />
	</DocsSection>
{/if}

{#if unit.veterancy?.length}
	<DocsSection title={t('Veterancy')}>
		<DocsVeterancy ranks={unit.veterancy} />
	</DocsSection>
{/if}

{#if page.calledInBy.length === 0 && page.producedBy.length === 0}
	<DocsSection title={t('Availability')}>
		<p class="text-secondary-400 text-sm">
			{t('Not built at a building: a starting unit, an emplacement crew or unlocked another way.')}
		</p>
	</DocsSection>
{/if}
