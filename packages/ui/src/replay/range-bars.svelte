<script lang="ts">
	import type { DocByRange } from '@company-of-heroes/game-data/types';
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { formatNumber } from '../docs/format';
	import { chanceTone } from './chance-tone';

	type Props = {
		label: string;
		values: Partial<Record<keyof DocByRange, number | null>>;
		/** Upper distance of the short / medium / long bands. */
		bands?: Partial<Record<keyof DocByRange, number | null>>;
		/** Values are 0–1 chances: show a percentage with a coloured bar. Off: the plain number. */
		chance?: boolean;
		/** `sm` for popovers, `md` for full pages (the wiki). */
		size?: 'sm' | 'md';
		class?: string;
	};

	let { label, values, bands, chance = true, size = 'sm', class: className }: Props = $props();
	const { t } = useI18n();

	const RANGES = ['short', 'medium', 'long'] as const;
	const RANGE_LABELS = { short: 'Short', medium: 'Medium', long: 'Long' } as const;
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
	<div class="mt-1.5 grid grid-cols-3 gap-2">
		{#each RANGES as range, index (range)}
			{@const value = values[range] ?? 0}
			{@const from = index === 0 ? 0 : bands?.[RANGES[index - 1]]}
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
							)}>{formatNumber(from ?? 0)}–{formatNumber(to)}</span
						>
					{/if}
				</p>
			</div>
		{/each}
	</div>
</div>
