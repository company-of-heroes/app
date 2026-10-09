<script lang="ts">
	import type { DocWeapon } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { tableHeadRow } from '@company-of-heroes/ui/variants';
	import ArrowsClockwiseIcon from 'phosphor-svelte/lib/ArrowsClockwiseIcon';
	import CircleDashedIcon from 'phosphor-svelte/lib/CircleDashedIcon';
	import CrosshairIcon from 'phosphor-svelte/lib/CrosshairIcon';
	import HourglassIcon from 'phosphor-svelte/lib/HourglassIcon';
	import LightningIcon from 'phosphor-svelte/lib/LightningIcon';
	import PersonSimpleRunIcon from 'phosphor-svelte/lib/PersonSimpleRunIcon';
	import RulerIcon from 'phosphor-svelte/lib/RulerIcon';
	import SwordIcon from 'phosphor-svelte/lib/SwordIcon';
	import TimerIcon from 'phosphor-svelte/lib/TimerIcon';
	import RangeBars from '../replay/range-bars.svelte';
	import StatChip from '../replay/stat-chip.svelte';
	import DocsCoverTable from './docs-cover-table.svelte';
	import { CLASSIC_COVER, effectivenessTone, formatNumber, targetTypeLabel } from './format';

	type Props = {
		weapon: DocWeapon;
		/** Also list the per-target multipliers (weapon pages). */
		showTargets?: boolean;
	};

	let { weapon, showTargets = false }: Props = $props();
	const { t } = useI18n();

	const RANGES = ['short', 'medium', 'long'] as const;

	const between = (min: number | null | undefined, max: number | null | undefined, unit = '') =>
		!max
			? null
			: min === max || !min
				? `${formatNumber(max)}${unit}`
				: `${formatNumber(min)}–${formatNumber(max)}${unit}`;
	const has = (values: DocWeapon['accuracy']) =>
		Boolean(values && RANGES.some((range) => values[range]));
	const seconds = (value: number | null | undefined) => (value ? `${formatNumber(value)}s` : null);

	const bands = $derived(weapon.range);
	// Times that change with distance (an SMG cools down faster up close), as multipliers per band.
	const timings = $derived(
		[
			{ label: t('Cooldown multiplier'), values: weapon.cooldown?.multipliers },
			{ label: t('Aim time multiplier'), values: weapon.aim?.multipliers },
			{ label: t('Reload multiplier'), values: weapon.reload?.multipliers }
		].filter((timing) => timing.values)
	);
	// No modifier in the game files means the weapon is unchanged against that target.
	const multiplier = (value: number | undefined) => `×${formatNumber(value ?? 1, 3)}`;
	const targets = $derived(
		Object.entries(weapon.targets ?? {}).sort(([a], [b]) => a.localeCompare(b))
	);
	const cell = 'px-4 py-2.5 text-right tabular-nums';
</script>

<!-- The weapon block from the stats popovers, with the extra numbers the game files have. -->
<div class="space-y-3 px-4 py-3">
	<div class="flex flex-wrap gap-1.5">
		<StatChip
			icon={SwordIcon}
			name={t('Damage')}
			value={between(weapon.damage?.min, weapon.damage?.max)}
			iconClass="text-red-300"
		/>
		<StatChip
			icon={RulerIcon}
			name={t('Range')}
			value={between(weapon.range?.min || weapon.range?.max, weapon.range?.max)}
		/>
		<StatChip
			icon={TimerIcon}
			name={t('Cooldown')}
			value={between(weapon.cooldown?.min, weapon.cooldown?.max, 's')}
		/>
		<StatChip
			icon={ArrowsClockwiseIcon}
			name={weapon.reload?.frequency
				? `${t('Reload')} · ${t('Reload frequency')} ${between(weapon.reload.frequency, weapon.reload.frequencyMax ?? weapon.reload.frequency)}`
				: t('Reload')}
			value={between(weapon.reload?.min, weapon.reload?.max, 's')}
		/>
		<StatChip icon={CrosshairIcon} name={t('Ready aim time')} value={seconds(weapon.aim?.ready)} />
		<StatChip
			icon={CrosshairIcon}
			name={t('Aim time')}
			value={between(weapon.aim?.min, weapon.aim?.max, 's')}
		/>
		<StatChip
			icon={LightningIcon}
			name={t('Burst')}
			value={between(weapon.burst?.min, weapon.burst?.max, 's')}
		/>
		<StatChip
			icon={LightningIcon}
			name={t('Rate of fire')}
			value={between(weapon.rateOfFire?.min, weapon.rateOfFire?.max, '/s')}
		/>
		<StatChip
			icon={CircleDashedIcon}
			name={t('Area radius')}
			value={weapon.areaRadius ? formatNumber(weapon.areaRadius) : null}
		/>
		<StatChip
			icon={HourglassIcon}
			name={t('Setup / teardown')}
			value={weapon.setup || weapon.teardown
				? `${formatNumber(weapon.setup ?? 0)}s / ${formatNumber(weapon.teardown ?? 0)}s`
				: null}
		/>
		<StatChip
			icon={PersonSimpleRunIcon}
			name={t('On the move')}
			value={weapon.movingAccuracy === undefined
				? null
				: weapon.canFireMoving === false
					? t('Cannot fire')
					: `${Math.round(weapon.movingAccuracy * 100)}%`}
		/>
	</div>
	<div class="grid gap-x-8 gap-y-3 sm:grid-cols-2">
		{#if has(weapon.accuracy)}
			<RangeBars label={t('Accuracy')} values={weapon.accuracy!} {bands} size="md" />
		{/if}
		{#if has(weapon.penetration)}
			<RangeBars label={t('Penetration')} values={weapon.penetration!} {bands} size="md" />
		{/if}
		{#if has(weapon.areaDamage)}
			<!-- Area damage falls off with the distance from the impact, not with the firing range. -->
			<RangeBars
				label={t('Area damage')}
				values={weapon.areaDamage!}
				bands={weapon.areaDistance}
				unit="m"
				size="md"
			/>
		{/if}
		{#if has(weapon.suppression)}
			<RangeBars
				label={t('Suppression')}
				values={weapon.suppression!}
				{bands}
				chance={false}
				size="md"
			/>
		{/if}
		{#each timings as timing (timing.label)}
			<RangeBars label={timing.label} values={timing.values!} {bands} chance={false} size="md" />
		{/each}
	</div>
</div>

{#if weapon.cover}
	<!-- Against a target in cover: the full table on the weapon page, the three classic covers elsewhere. -->
	<DocsCoverTable
		cover={weapon.cover}
		columns={[
			{ key: 'accuracy', label: t('Accuracy') },
			{ key: 'damage', label: t('Damage') },
			{ key: 'penetration', label: t('Penetration') },
			{ key: 'suppression', label: t('Suppression') }
		]}
		only={showTargets ? undefined : CLASSIC_COVER}
		perspective="weapon"
		coverLabel={t('Target is in')}
		caption={t('When this weapon fires at a target in cover: how well that target is protected.')}
		class="border-secondary-800 border-t"
	/>
{/if}

{#if showTargets && targets.length}
	<div class="border-secondary-800 overflow-x-auto border-t">
		<p class="text-secondary-400 px-4 py-2 text-xs">
			{t('How effective this weapon is against each armour type.')}
		</p>
		<table class="w-full border-collapse text-sm">
			<thead>
				<tr class={tableHeadRow}>
					<th class="px-4 py-2.5 text-left font-semibold">{t('Target type')}</th>
					<th class={cn(cell, 'font-semibold')}>{t('Damage')}</th>
					<th class={cn(cell, 'font-semibold')}>{t('Accuracy')}</th>
					<th class={cn(cell, 'font-semibold')}>{t('Penetration')}</th>
					<th class={cn(cell, 'font-semibold')}>{t('Rear penetration')}</th>
					<th class={cn(cell, 'font-semibold')}>{t('Suppression')}</th>
				</tr>
			</thead>
			<tbody>
				{#each targets as [type, multipliers] (type)}
					<tr class="border-secondary-800 border-b last:border-b-0">
						<th scope="row" class="px-4 py-2.5 text-left font-medium text-white">
							{targetTypeLabel(type)}
						</th>
						{#if multipliers.disabled}
							<td colspan="5" class={cn(cell, 'text-secondary-400 font-semibold')}>
								{t('Cannot target')}
							</td>
						{:else}
							<td class={cn(cell, 'font-semibold', effectivenessTone(multipliers.damage))}>
								{multiplier(multipliers.damage)}
							</td>
							<td class={cn(cell, 'font-semibold', effectivenessTone(multipliers.accuracy))}>
								{multiplier(multipliers.accuracy)}
							</td>
							<td class={cn(cell, 'font-semibold', effectivenessTone(multipliers.penetration))}>
								{multiplier(multipliers.penetration)}
							</td>
							<td class={cn(cell, 'font-semibold', effectivenessTone(multipliers.rearPenetration))}>
								{multiplier(multipliers.rearPenetration)}
							</td>
							<td class={cn(cell, 'font-semibold', effectivenessTone(multipliers.suppression))}>
								{multiplier(multipliers.suppression)}
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
