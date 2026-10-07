<script lang="ts">
	import {
		loadReplayStats,
		type ReplayStats,
		type ReplayWeapon
	} from '@company-of-heroes/game-data/replay';
	import type { DocModifier } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import HeartIcon from 'phosphor-svelte/lib/HeartIcon';
	import RulerIcon from 'phosphor-svelte/lib/RulerIcon';
	import ShieldIcon from 'phosphor-svelte/lib/ShieldIcon';
	import SwordIcon from 'phosphor-svelte/lib/SwordIcon';
	import TimerIcon from 'phosphor-svelte/lib/TimerIcon';
	import UsersThreeIcon from 'phosphor-svelte/lib/UsersThreeIcon';
	import { interactive, popoverSection } from '../variants';
	import { tryUseHost } from '../host/host.context';
	import { docsPath, formatNumber, uniqueEffects } from '../docs/format';
	import EffectRows from './effect-rows.svelte';
	import RangeBars from './range-bars.svelte';
	import StatChip from './stat-chip.svelte';
	import VeterancyRanks from './veterancy-ranks.svelte';

	type Props = {
		/** Blueprint list of the replay objectId: squads or upgrades (doctrine unlocks included). */
		list: string;
		id: number;
		class?: string;
	};

	let { list, id, class: className }: Props = $props();
	const { t } = useI18n();
	const host = tryUseHost();

	let stats = $state<ReplayStats>();
	$effect(() => {
		void loadReplayStats().then((table) => (stats = table));
	});

	const unit = $derived(list === 'sbps' ? stats?.sbps[id] : undefined);
	const upgrade = $derived(list === 'upgrade' ? stats?.upgrade[id] : undefined);
	const weapons = $derived(
		(unit?.weapons ?? upgrade?.weapons ?? [])
			.map((slug) => {
				const weapon = stats?.weapons[slug];
				return weapon && { ...weapon, slug };
			})
			.filter((weapon): weapon is ReplayWeapon & { slug: string } => weapon !== undefined)
	);

	const between = (range: { min: number | null; max: number | null } | undefined, unit = '') =>
		!range?.max
			? null
			: range.min === range.max || !range.min
				? `${formatNumber(range.max)}${unit}`
				: `${formatNumber(range.min)}–${formatNumber(range.max)}${unit}`;

	const TRACKS = [
		{ key: 'offensive', label: 'Offensive', icon: SwordIcon },
		{ key: 'defensive', label: 'Defensive', icon: ShieldIcon }
	] as const;

	/** Consecutive ranks with the same bonus are one row ("Rank 1–3"). */
	function rankGroups(ids: number[]) {
		const groups: { from: number; to: number; effects: DocModifier[] }[] = [];
		ids.forEach((id, index) => {
			const effects = uniqueEffects(stats?.upgrade[id]?.effects ?? []);
			const last = groups.at(-1);
			if (last && JSON.stringify(last.effects) === JSON.stringify(effects)) {
				last.to = index + 1;
			} else if (effects.length) {
				groups.push({ from: index + 1, to: index + 1, effects });
			}
		});
		return groups;
	}

	const label = 'text-secondary-500 text-[10px] font-semibold tracking-wide uppercase';
	const chip = 'bg-secondary-900 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5';
</script>

<!-- Full-width sections, each with a divider on top: the popover itself has no padding. -->
{#if unit || upgrade}
	<div class={className}>
		{#if unit?.health || upgrade?.effects?.length}
			<div class={cn(popoverSection, 'space-y-2')}>
				{#if unit?.health}
					<div class="flex flex-wrap gap-1.5">
						<StatChip
							icon={HeartIcon}
							name={t('Health')}
							value={formatNumber(unit.health, 0)}
							iconClass="text-red-300"
						/>
						{#if unit.size && unit.size > 1}
							<StatChip icon={UsersThreeIcon} name={t('Squad size')} value={unit.size} />
						{/if}
					</div>
				{/if}
				{#if upgrade?.effects?.length}
					<div>
						<p class={cn(label, 'mb-1')}>{t('Effects')}</p>
						<EffectRows effects={upgrade.effects} />
					</div>
				{/if}
			</div>
		{/if}
		{#each weapons as weapon (weapon.slug)}
			{@const path = host?.api.docs ? docsPath({ kind: 'weapon', slug: weapon.slug }) : null}
			<div class={popoverSection}>
				<p class="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-white">
					{#if path}
						<!-- Hosts with the wiki link each weapon to its page. -->
						<a
							href={host?.href(path)}
							class={cn(interactive, 'hover:text-primary truncate hover:underline')}
						>
							{weapon.name}
						</a>
					{:else}
						<span class="truncate">{weapon.name}</span>
					{/if}
				</p>
				<div class="mt-1.5 flex flex-wrap gap-1.5">
					<StatChip
						icon={SwordIcon}
						name={t('Damage')}
						value={between(weapon.damage)}
						iconClass="text-red-300"
					/>
					<StatChip
						icon={RulerIcon}
						name={t('Range')}
						value={weapon.range ? formatNumber(weapon.range) : null}
					/>
					<StatChip icon={TimerIcon} name={t('Cooldown')} value={between(weapon.cooldown, 's')} />
				</div>
				{#if weapon.accuracy}
					<RangeBars
						label={t('Accuracy')}
						values={weapon.accuracy}
						bands={weapon.bands}
						class="mt-2.5"
					/>
				{/if}
			</div>
		{/each}
		{#if unit?.veterancy?.length && !unit.vetUpgrades}
			<div class={popoverSection}>
				<p class={label}>{t('Veterancy')}</p>
				<VeterancyRanks ranks={unit.veterancy} class="mt-1" />
			</div>
		{/if}
		{#if unit?.vetUpgrades}
			<div class={popoverSection}>
				<p class={label}>{t('Veterancy')}</p>
				<p class="text-secondary-500 mt-0.5 text-[10px]">
					{t('Bought per rank: offensive or defensive')}
				</p>
				{#each TRACKS as track (track.key)}
					{@const groups = rankGroups(unit.vetUpgrades[track.key] ?? [])}
					{#if groups.length}
						<div class="mt-2.5">
							<p class="flex items-center gap-1.5 text-xs font-semibold text-white">
								<track.icon class="text-secondary-300 size-3.5" weight="fill" />
								{t(track.label)}
							</p>
							<ol>
								{#each groups as group (group.from)}
									<li class="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-2 py-1.5 last:pb-0">
										<span class="text-secondary-500 pt-0.5 text-[10px] tabular-nums">
											{t('Rank {ranks}', {
												ranks: group.from === group.to ? group.from : `${group.from}–${group.to}`
											})}
										</span>
										<EffectRows effects={group.effects} />
									</li>
								{/each}
							</ol>
						</div>
					{/if}
				{/each}
				<!-- Reaching a rank (by buying a bonus) can add its own bonus on top, e.g. health. -->
				{#if unit.veterancy?.length}
					<div class="mt-2.5">
						<p class="text-xs font-semibold text-white">{t('Every rank also')}</p>
						<ol>
							{#each unit.veterancy as rank (rank.rank)}
								<li class="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-2 py-1.5 last:pb-0">
									<span class="text-secondary-500 pt-0.5 text-[10px] tabular-nums">
										{t('Rank {ranks}', { ranks: rank.rank })}
									</span>
									<EffectRows effects={rank.effects} />
								</li>
							{/each}
						</ol>
					</div>
				{/if}
			</div>
		{/if}
		{#if upgrade?.abilities?.length}
			<div class={cn(popoverSection, 'space-y-1.5')}>
				<p class={label}>{t('Unlocks')}</p>
				<div class="flex flex-wrap gap-1.5">
					{#each upgrade.abilities as ability (ability)}
						<span class={cn(chip, 'text-xs font-semibold text-white')}>{ability}</span>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}
