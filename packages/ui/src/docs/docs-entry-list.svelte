<script lang="ts">
	import type {
		DocAbility,
		DocRef,
		DocUpgrade,
		DocUpgradeEntry
	} from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import RulerIcon from 'phosphor-svelte/lib/RulerIcon';
	import TimerIcon from 'phosphor-svelte/lib/TimerIcon';
	import EffectRows from '../replay/effect-rows.svelte';
	import StatChip from '../replay/stat-chip.svelte';
	import DocsCost from './docs-cost.svelte';
	import DocsIcon from './docs-icon.svelte';
	import { popoverEntry, useDocsPopover } from './docs-popover.context';
	import { useHost } from '../host/host.context';

	type Props = {
		/** Abilities or upgrades; they have no page of their own. */
		entries: (
			| DocAbility
			| DocUpgrade
			| DocUpgradeEntry
			| (DocUpgradeEntry & { researchedAt: DocRef[] })
			| (DocAbility & { requiredRefs: DocRef[] })
		)[];
	};

	let { entries }: Props = $props();
	const { t } = useI18n();
	const host = useHost();
	const popover = useDocsPopover();

	/** The weapon an entry adds or fires: an upgrade's weapon (also via its abilities), or an ability's. */
	function weaponOf(entry: Props['entries'][number]): string | undefined {
		if ('weaponRefs' in entry) {
			return entry.weapon;
		}

		return entry.weapons?.length === 1 ? entry.weapons[0] : undefined;
	}

	/** Hover handlers that open the stats popover of an upgrade (its weapon block). */
	function upgradePopover(upgrade: DocUpgrade) {
		const entry = popoverEntry({
			kind: 'upgrade',
			slug: upgrade.slug,
			id: upgrade.id,
			name: upgrade.name,
			faction: upgrade.factions[0]
		});
		return popover && entry ? popover.hoverTrigger(entry) : {};
	}
</script>

<!-- Each entry reads like a stats popover: name and cost, what it does, its effects. Every row has
a bottom line and the list overlaps its panel's closing line by 1px: no missing or double line
when two lists sit side by side. -->
<ul class="-mb-px">
	{#each entries as entry (entry.slug)}
		{@const weapon = weaponOf(entry)}
		<li class="border-secondary-800 flex gap-3 border-b px-4 py-2.5">
			<DocsIcon icon={entry.icon} name={entry.name} class="size-10" />
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
					{#if weapon}
						<!-- An upgrade that adds a weapon: the title links to the weapon, hover shows its stats. -->
						<a
							href={host.href(`/wiki/weapons/${weapon}`)}
							class={cn(
								interactive,
								'hover:text-primary decoration-secondary-600 leading-tight font-semibold text-white underline underline-offset-4 transition-colors'
							)}
							{...'weaponRefs' in entry ? upgradePopover(entry) : {}}
						>
							{entry.name}
						</a>
					{:else}
						<p class="leading-tight font-semibold text-white">{entry.name}</p>
					{/if}
					<div class="flex flex-wrap items-center gap-1.5">
						<DocsCost cost={entry.cost} />
						{#if 'recharge' in entry && entry.recharge}
							<StatChip
								icon={TimerIcon}
								name={t('Recharge')}
								value={t('{seconds}s', { seconds: entry.recharge })}
							/>
						{/if}
						{#if 'range' in entry && entry.range}
							<StatChip icon={RulerIcon} name={t('Range')} value={entry.range} />
						{/if}
					</div>
				</div>
				{#if !weapon && 'weaponRefs' in entry && entry.weaponRefs.length}
					<!-- An upgrade that unlocks several things: its weapons as separate links. -->
					<p class="text-secondary-400 mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm">
						{t('Weapons')}:
						{#each entry.weaponRefs as ref, index (ref.slug)}
							<a
								href={host.href(`/wiki/weapons/${ref.slug}`)}
								class={cn(interactive, 'font-medium text-white hover:underline')}
							>
								{ref.name}</a
							>{#if index < entry.weaponRefs.length - 1}<span class="text-secondary-500">·</span
								>{/if}
						{/each}
					</p>
				{/if}
				{#if 'requiredRefs' in entry && entry.requiredRefs.length}
					<!-- Abilities that need research first (Throw Grenade → Mk2 Grenades). -->
					<p class="text-secondary-400 mt-0.5 flex flex-wrap items-center gap-x-2 text-sm">
						{t('Requires')}
						{#each entry.requiredRefs as upgrade (upgrade.slug)}
							<span class="inline-flex items-center gap-1.5 font-medium text-white">
								<DocsIcon icon={upgrade.icon} name={upgrade.name} class="size-5" />
								{upgrade.name}
							</span>
						{/each}
					</p>
				{/if}
				{#if 'researchedAt' in entry && entry.researchedAt.length}
					<p class="text-secondary-400 mt-0.5 flex flex-wrap items-center gap-x-2 text-sm">
						{t('Researched at')}
						{#each entry.researchedAt as building (building.slug)}
							<a
								href={host.href(`/wiki/buildings/${building.slug}`)}
								class={cn(
									interactive,
									'inline-flex items-center gap-1.5 font-medium text-white hover:underline'
								)}
							>
								<DocsIcon icon={building.icon} name={building.name} class="size-5" />
								{building.name}
							</a>
						{/each}
					</p>
				{/if}
				{#if entry.help}
					<p class="text-secondary-300 mt-0.5 max-w-3xl text-sm leading-snug">{entry.help}</p>
				{/if}
				{#if entry.extra}
					<p class="text-primary mt-0.5 text-sm font-semibold">{entry.extra}</p>
				{/if}
				{#if entry.effects?.length}
					<EffectRows effects={entry.effects} inline class="mt-1.5 text-sm leading-snug" />
				{/if}
			</div>
		</li>
	{/each}
</ul>
