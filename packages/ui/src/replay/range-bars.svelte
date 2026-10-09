<script lang="ts">
	import type { DocByRange } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { formatNumber } from '../docs/format';
	import { chanceTone } from './chance-tone';

	type Props = {
		label: string;
		values: Partial<Record<keyof DocByRange, number | null>>;
		/** Upper distance of the short / medium / long (/ distant) bands. */
		bands?: Partial<Record<keyof DocByRange, number | null>>;
		/** Unit after the band distances (`m` for area damage around the impact). */
		unit?: string;
		/** Values are 0–1 chances: show a percentage with a coloured bar. Off: the plain number. */
		chance?: boolean;
		/** `sm` for popovers, `md` for full pages (the wiki). */
		size?: 'sm' | 'md';
		class?: string;
	};

	let {
		label,
		values,
		bands,
		unit = '',
		chance = true,
		size = 'sm',
		class: className
	}: Props = $props();
	const { t } = useI18n();

	const RANGE_LABELS = {
		short: 'Short',
		medium: 'Medium',
		long: 'Long',
		distant: 'Distant'
	} as const;
	// The distant band (past long range, up to max range) only where the weapon has one.
	const ranges = $derived(
		values.distant !== undefined && values.distant !== null
			? (['short', 'medium', 'long', 'distant'] as const)
			: (['short', 'medium', 'long'] as const)
	);
</script>

<div class={className}>
	<p
		class={cn(
			'font-semibold tracking-wide uppercase',
			size === 'md' ? 'text-secondary-400 text-xs' : 'text-secondary-500 text-[10px]'
		)}
	>
		{label}
	</p>
	<div class={cn('mt-1.5 grid gap-2', ranges.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
		{#each ranges as range, index (range)}
			{@const value = values[range] ?? 0}
			{@const from = index === 0 ? 0 : bands?.[ranges[index - 1]]}
			{@const to = bands?.[range]}
			<div>
				<p
					class={cn(
						'font-semibold text-white tabular-nums',
						size === 'md' ? 'text-base' : 'text-sm'
					)}
				>
					{chance ? `${Math.round(value * 100)}%` : formatNumber(value, 4)}
				</p>
				{#if chance}
					<div
						class={cn(
							'bg-secondary-800 mt-1 overflow-hidden rounded-full',
							size === 'md' ? 'h-2' : 'h-1.5'
						)}
					>
						<div
							class={cn('h-full rounded-full', chanceTone(value))}
							style:width="{Math.min(value, 1) * 100}%"
						></div>
					</div>
				{/if}
				<p
					class={cn(
						'text-secondary-400 mt-1 leading-tight',
						size === 'md' ? 'text-xs' : 'text-[10px]'
					)}
				>
					{t(RANGE_LABELS[range])}
					{#if to}
						<span
							class={cn(
								'tabular-nums',
								size === 'md' ? 'text-secondary-300' : 'text-secondary-500'
							)}>{formatNumber(from ?? 0)}–{formatNumber(to)}{unit}</span
						>
					{/if}
				</p>
			</div>
		{/each}
	</div>
</div>
