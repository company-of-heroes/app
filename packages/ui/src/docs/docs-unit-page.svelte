<script lang="ts">
	import type { Snippet } from 'svelte';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import {
		flushHeader,
		flushHeaderTitle,
		interactive,
		tableHeadText
	} from '@company-of-heroes/ui/variants';
	import EyeIcon from 'phosphor-svelte/lib/EyeIcon';
	import GaugeIcon from 'phosphor-svelte/lib/GaugeIcon';
	import HeartIcon from 'phosphor-svelte/lib/HeartIcon';
	import FactoryIcon from 'phosphor-svelte/lib/FactoryIcon';
	import ParachuteIcon from 'phosphor-svelte/lib/ParachuteIcon';
	import ShieldIcon from 'phosphor-svelte/lib/ShieldIcon';
	import UserPlusIcon from 'phosphor-svelte/lib/UserPlusIcon';
	import UsersThreeIcon from 'phosphor-svelte/lib/UsersThreeIcon';
	import SwordIcon from 'phosphor-svelte/lib/SwordIcon';
	import { useHost } from '../host/host.context';
	import VeterancyRanks from '../replay/veterancy-ranks.svelte';
	import DocsCost from './docs-cost.svelte';
	import DocsCoverTable from './docs-cover-table.svelte';
	import DocsEntryList from './docs-entry-list.svelte';
	import DocsHeader from './docs-header.svelte';
	import DocsIcon from './docs-icon.svelte';
	import DocsLayout from './docs-layout.svelte';
	import DocsNote from './docs-note.svelte';
	import DocsSection from './docs-section.svelte';
	import DocsWeaponBlock from './docs-weapon-block.svelte';
	import { docsPath, formatNumber, targetTypeLabel } from './format';
	import type { DocsUnitPageData } from './types';

	type Props = {
		page: DocsUnitPageData;
	};

	let { page }: Props = $props();
	const host = useHost();
	const { t } = useI18n();

	const unit = $derived(page.unit);
	const VET_TRACKS = [
		{ key: 'offensive', label: 'Offensive', icon: SwordIcon },
		{ key: 'defensive', label: 'Defensive', icon: ShieldIcon }
	] as const;
	const RATINGS = [
		{ key: 'infantry', label: 'Infantry' },
		{ key: 'lightarmor', label: 'Light vehicles' },
		{ key: 'heavyarmor', label: 'Tanks' },
		{ key: 'structures', label: 'Structures' }
	];
	/** The game rates effectiveness 1–10 (`ui_unit_ratings`); two steps per word and colour. */
	const RATING_MAX = 10;
	const RATING_STEPS = [
		{ word: 'Poor', bar: 'bg-red-400/80', text: 'text-red-300' },
		{ word: 'Weak', bar: 'bg-red-400/80', text: 'text-red-300' },
		{ word: 'Fair', bar: 'bg-amber-400/80', text: 'text-amber-300' },
		{ word: 'Good', bar: 'bg-green-400/80', text: 'text-green-300' },
		{ word: 'Excellent', bar: 'bg-green-400/80', text: 'text-green-300' }
	];
	const ratingStep = (value: number) =>
		RATING_STEPS[Math.min(Math.max(Math.ceil(value / 2), 1), RATING_STEPS.length) - 1];
	const ratings = $derived(RATINGS.filter((rating) => unit.ratings?.[rating.key]));
	const hasReinforce = $derived(Boolean(unit.reinforce && Object.keys(unit.reinforce).length));
	const link = cn(interactive, 'font-medium text-white hover:underline');
	const panelHeader = cn(flushHeader, 'flex items-baseline justify-between gap-3');
</script>

<!-- Label left, value right: the "Did you know?" rows on /stats. -->
{#snippet fact(
	label: string,
	value: Snippet,
	Icon?: typeof HeartIcon,
	iconClass = 'text-secondary-500'
)}
	<li class="flex items-center gap-3 px-4 py-2 text-sm">
		<span class="text-secondary-400 flex shrink-0 items-center gap-2">
			{#if Icon}
				<Icon class={cn('size-4', iconClass)} weight="fill" />
			{/if}
			{label}
		</span>
		<div class="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right">
			{@render value()}
		</div>
	</li>
{/snippet}

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

<DocsLayout>
	{#snippet main()}
		{#if page.vetUpgrades.offensive.length || page.vetUpgrades.defensive.length}
			<!-- Panzer Elite buys veterancy per rank; the two tracks side by side, rank 1 to 3. -->
			<DocsSection
				title={t('Veterancy bonuses')}
				note={t('Bought per rank: offensive or defensive')}
			>
				<div class="divide-secondary-800 grid lg:grid-cols-2 lg:divide-x">
					{#each VET_TRACKS as track (track.key)}
						<div class="min-w-0">
							<p
								class={cn(
									tableHeadText,
									'bg-secondary-950/90 border-secondary-800 flex items-center gap-2 border-b px-4 py-2'
								)}
							>
								<track.icon class="size-3.5" weight="fill" />
								{t(track.label)}
							</p>
							<DocsEntryList entries={page.vetUpgrades[track.key]} />
						</div>
					{/each}
				</div>
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
		{#if page.research.length}
			<DocsSection title={t('Research')}>
				<DocsEntryList entries={page.research} />
			</DocsSection>
		{/if}
	{/snippet}
	{#snippet side()}
		{#key unit.slug}
			<DocsNote kind="unit" slug={unit.slug} note={page.note} />
		{/key}
		<section>
			<div class={panelHeader}><h2 class={flushHeaderTitle}>{t('Details')}</h2></div>
			<ul class="divide-secondary-800 divide-y">
				{#if unit.size}
					{#snippet size()}<span class="font-medium text-white tabular-nums">{unit.size}</span
						>{/snippet}
					{@render fact(t('Squad size'), size, UsersThreeIcon)}
				{/if}
				{#if hasReinforce}
					{#snippet reinforce()}<DocsCost cost={unit.reinforce} />{/snippet}
					{@render fact(t('Reinforce'), reinforce, UserPlusIcon)}
				{/if}
				{#if page.producedBy.length}
					{#snippet builtAt()}
						{#each page.producedBy as producer (producer.slug)}
							{@const path = docsPath(producer)}
							{#if path}
								<a href={host.href(path)} class={cn(link, 'inline-flex items-center gap-2')}>
									<DocsIcon icon={producer.icon} name={producer.name} class="size-6" />
									{producer.name}
								</a>
							{:else}
								<span class="inline-flex items-center gap-2 font-medium text-white">
									<DocsIcon icon={producer.icon} name={producer.name} class="size-6" />
									{producer.name}
								</span>
							{/if}
						{/each}
					{/snippet}
					{@render fact(t('Built at'), builtAt, FactoryIcon)}
				{/if}
				{#each page.calledInBy as callIn (`${callIn.commander.slug}:${callIn.tier.slug}`)}
					{#snippet calledIn()}
						<!-- Doctrine icon with its name, and the tier that unlocks the call-in under it. -->
						<a
							href={host.href(docsPath(callIn.commander) ?? '/wiki')}
							class={cn(interactive, 'group flex items-center gap-2.5 text-left')}
						>
							<DocsIcon icon={callIn.commander.icon} name={callIn.commander.name} class="size-8" />
							<span class="flex flex-col leading-tight">
								<span class="font-medium text-white group-hover:underline">
									{callIn.commander.name}
								</span>
								<span class="text-secondary-400 text-xs">{callIn.tier.name}</span>
							</span>
						</a>
						{#if callIn.ability?.cost}
							<DocsCost cost={callIn.ability.cost} />
						{/if}
					{/snippet}
					{@render fact(t('Call-in'), calledIn, ParachuteIcon)}
				{/each}
				{#if page.calledInBy.length === 0 && page.producedBy.length === 0}
					<li class="text-secondary-400 px-4 py-2 text-sm">
						{t(
							'Not built at a building: a starting unit, an emplacement crew or unlocked another way.'
						)}
					</li>
				{/if}
				<!-- Model stats as rows; a squad of several model types gets a small heading per type. -->
				{#each unit.models ?? [] as model (model.slug)}
					{#if (unit.models?.length ?? 0) > 1}
						<li
							class={cn(
								tableHeadText,
								'bg-secondary-950/90 text-secondary-400 px-4 py-1.5 text-[11px]'
							)}
						>
							{model.count}× {model.name ?? targetTypeLabel(model.slug)}
						</li>
					{/if}
					{#if model.hitpoints}
						{#snippet health()}<span class="font-medium text-white tabular-nums"
								>{formatNumber(model.hitpoints ?? 0, 0)}</span
							>{/snippet}
						{@render fact(t('Health'), health, HeartIcon, 'text-red-300')}
					{/if}
					{#if model.targetType}
						{#snippet armor()}<span class="font-medium text-white"
								>{targetTypeLabel(model.targetType ?? '')}</span
							>{/snippet}
						{@render fact(t('Armor type'), armor, ShieldIcon)}
					{/if}
					{#if model.speed}
						{#snippet speed()}<span class="font-medium text-white tabular-nums"
								>{formatNumber(model.speed ?? 0)}</span
							>{/snippet}
						{@render fact(t('Top speed'), speed, GaugeIcon)}
					{/if}
					{#if model.sight}
						{#snippet sight()}<span class="font-medium text-white tabular-nums"
								>{formatNumber(model.sight ?? 0, 0)}</span
							>{/snippet}
						{@render fact(t('Sight'), sight, EyeIcon)}
					{/if}
				{/each}
			</ul>
		</section>
		{#if unit.cover && Object.keys(unit.cover).length}
			<DocsSection title={t('In cover')}>
				<DocsCoverTable
					cover={unit.cover}
					coverLabel={t('When in')}
					columns={[
						{ key: 'suppressionRecovery', label: t('Suppression recovery') },
						{ key: 'speed', label: t('Speed') }
					]}
				/>
			</DocsSection>
		{/if}
		{#if ratings.length}
			<section>
				<div class={panelHeader}><h2 class={flushHeaderTitle}>{t('Effective against')}</h2></div>
				<ul class="divide-secondary-800 divide-y">
					{#each ratings as rating (rating.key)}
						{@const value = unit.ratings?.[rating.key] ?? 0}
						{#snippet bar()}
							<!-- One bar per target, coloured like the accuracy bars, with a word for the score. -->
							<span
								class="flex items-center gap-3"
								aria-label={t('{value} out of {max}', { value, max: RATING_MAX })}
							>
								<span class="bg-secondary-800 h-2 w-28 overflow-hidden rounded-full">
									<span
										class={cn('block h-full rounded-full', ratingStep(value).bar)}
										style:width="{Math.min(value / RATING_MAX, 1) * 100}%"
									></span>
								</span>
								<span class={cn('w-16 text-sm font-semibold', ratingStep(value).text)}>
									{t(ratingStep(value).word)}
								</span>
							</span>
						{/snippet}
						{@render fact(t(rating.label), bar)}
					{/each}
				</ul>
			</section>
		{/if}
		{#if unit.veterancy?.length}
			{#if unit.veterancy.some((rank) => rank.effects.length)}
				<DocsSection title={t('Veterancy')} padded>
					<VeterancyRanks ranks={unit.veterancy} size="md" class="max-w-sm" />
				</DocsSection>
			{:else}
				<!-- No bonuses of its own (bought instead): just the experience each rank takes. -->
				<DocsSection title={t('Veterancy')}>
					<ul class="flex flex-wrap gap-x-8 gap-y-2 px-4 py-3">
						{#each unit.veterancy as rank (rank.rank)}
							{@const insignia = host.resolve.actionIcon(`veterancy_lv${rank.rank}`)}
							<li class="flex items-center gap-2.5 text-sm">
								{#if insignia}
									<!-- The insignia art has a dark band on top; show only the bar so it centres on the text. -->
									<span class="block h-2 overflow-hidden">
										<img
											src={insignia}
											alt={t('Veterancy {rank}', { rank: rank.rank })}
											class="-mt-1 h-3 w-auto max-w-none"
										/>
									</span>
								{/if}
								<span class="font-medium text-white tabular-nums">
									{t('{xp} XP', { xp: formatNumber(rank.experience ?? 0, 0) })}
								</span>
							</li>
						{/each}
					</ul>
				</DocsSection>
			{/if}
		{/if}
	{/snippet}
</DocsLayout>
