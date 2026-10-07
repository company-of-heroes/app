<script lang="ts">
	import type { DocByRange, DocWeapon } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { tableHeadRow } from '@company-of-heroes/ui/variants';
	import * as List from '../ui/list';
	import { formatNumber, targetTypeLabel } from './format';

	type Props = {
		weapon: DocWeapon;
		/** Also list the per-target multipliers (weapon pages). */
		showTargets?: boolean;
	};

	let { weapon, showTargets = false }: Props = $props();
	const { t } = useI18n();

	const RANGES = ['short', 'medium', 'long'] as const;

	const percent = (value: number | null | undefined) =>
		value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`;
	const between = (min: number | null | undefined, max: number | null | undefined, unit = '') =>
		min === max || max === null || max === undefined
			? `${formatNumber(min)}${unit}`
			: `${formatNumber(min)}–${formatNumber(max)}${unit}`;

	const rows = $derived(
		[
			{ label: t('Accuracy'), values: weapon.accuracy, format: percent },
			{ label: t('Penetration'), values: weapon.penetration, format: percent },
			{
				label: t('Suppression'),
				values: weapon.suppression,
				format: (v: number | null) => formatNumber(v, 4)
			},
			{ label: t('Area damage'), values: weapon.areaDamage, format: percent }
		].filter(
			(row): row is { label: string; values: DocByRange; format: (v: number | null) => string } =>
				Boolean(row.values && RANGES.some((range) => row.values?.[range]))
		)
	);
	const targets = $derived(
		Object.entries(weapon.targets ?? {}).sort(([a], [b]) => a.localeCompare(b))
	);
	const cell = 'px-3 py-2 text-right tabular-nums';
</script>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
	<List.Root class="grid-cols-[10rem_minmax(0,1fr)] content-start gap-x-4">
		{#if weapon.damage?.max}
			<List.Title>{t('Damage')}</List.Title>
			<List.Value>{between(weapon.damage.min, weapon.damage.max)}</List.Value>
		{/if}
		{#if weapon.range?.max}
			<List.Title>{t('Range')}</List.Title>
			<List.Value>{between(weapon.range.min || weapon.range.max, weapon.range.max)}</List.Value>
		{/if}
		{#if weapon.cooldown?.max}
			<List.Title>{t('Cooldown')}</List.Title>
			<List.Value>{between(weapon.cooldown.min, weapon.cooldown.max, 's')}</List.Value>
		{/if}
		{#if weapon.reload?.max}
			<List.Title>{t('Reload')}</List.Title>
			<List.Value>{between(weapon.reload.min, weapon.reload.max, 's')}</List.Value>
			{#if weapon.reload.frequency}
				<List.Title>{t('Reload frequency')}</List.Title>
				<List.Value>{formatNumber(weapon.reload.frequency)}</List.Value>
			{/if}
		{/if}
		{#if weapon.aim}
			<List.Title>{t('Aim time')}</List.Title>
			<List.Value>{formatNumber(weapon.aim)}s</List.Value>
		{/if}
		{#if weapon.burst}
			<List.Title>{t('Burst')}</List.Title>
			<List.Value>{formatNumber(weapon.burst)}s</List.Value>
		{/if}
		{#if weapon.areaRadius}
			<List.Title>{t('Area radius')}</List.Title>
			<List.Value>{formatNumber(weapon.areaRadius)}</List.Value>
		{/if}
		{#if weapon.movingAccuracy !== undefined}
			<List.Title>{t('On the move')}</List.Title>
			<List.Value>
				{weapon.canFireMoving === false
					? t('Cannot fire')
					: t('{percent} accuracy', { percent: percent(weapon.movingAccuracy) })}
			</List.Value>
		{/if}
		{#if weapon.setup || weapon.teardown}
			<List.Title>{t('Setup / teardown')}</List.Title>
			<List.Value
				>{formatNumber(weapon.setup ?? 0)}s / {formatNumber(weapon.teardown ?? 0)}s</List.Value
			>
		{/if}
	</List.Root>

	{#if rows.length}
		<div class="border-secondary-800 overflow-x-auto rounded-sm border">
			<table class="w-full text-sm">
				<thead>
					<tr class={tableHeadRow}>
						<th class="px-3 py-2 text-left font-semibold"></th>
						<th class={cn(cell, 'font-semibold')}>
							{t('Short')}
							{#if weapon.range?.short}<span class="text-secondary-500 block font-normal"
									>≤{weapon.range.short}</span
								>{/if}
						</th>
						<th class={cn(cell, 'font-semibold')}>
							{t('Medium')}
							{#if weapon.range?.medium}<span class="text-secondary-500 block font-normal"
									>≤{weapon.range.medium}</span
								>{/if}
						</th>
						<th class={cn(cell, 'font-semibold')}>
							{t('Long')}
							{#if weapon.range?.long}<span class="text-secondary-500 block font-normal"
									>≤{weapon.range.long}</span
								>{/if}
						</th>
					</tr>
				</thead>
				<tbody class="divide-secondary-800 divide-y">
					{#each rows as row (row.label)}
						<tr>
							<th scope="row" class="text-secondary-300 px-3 py-2 text-left font-medium"
								>{row.label}</th
							>
							{#each RANGES as range (range)}
								<td class={cell}>{row.format(row.values[range])}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

{#if showTargets && targets.length}
	<div class="border-secondary-800 mt-6 overflow-x-auto rounded-sm border">
		<table class="w-full text-sm">
			<thead>
				<tr class={tableHeadRow}>
					<th class="px-3 py-2 text-left font-semibold">{t('Target type')}</th>
					<th class={cn(cell, 'font-semibold')}>{t('Damage')}</th>
					<th class={cn(cell, 'font-semibold')}>{t('Accuracy')}</th>
					<th class={cn(cell, 'font-semibold')}>{t('Penetration')}</th>
					<th class={cn(cell, 'font-semibold')}>{t('Suppression')}</th>
				</tr>
			</thead>
			<tbody class="divide-secondary-800 divide-y">
				{#each targets as [type, multipliers] (type)}
					<tr>
						<th scope="row" class="text-secondary-300 px-3 py-2 text-left font-medium"
							>{targetTypeLabel(type)}</th
						>
						<td class={cell}
							>{multipliers.damage !== undefined
								? `×${formatNumber(multipliers.damage, 3)}`
								: '—'}</td
						>
						<td class={cell}
							>{multipliers.accuracy !== undefined
								? `×${formatNumber(multipliers.accuracy, 3)}`
								: '—'}</td
						>
						<td class={cell}
							>{multipliers.penetration !== undefined
								? `×${formatNumber(multipliers.penetration, 3)}`
								: '—'}</td
						>
						<td class={cell}
							>{multipliers.suppression !== undefined
								? `×${formatNumber(multipliers.suppression, 3)}`
								: '—'}</td
						>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
