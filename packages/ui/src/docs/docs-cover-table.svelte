<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { tableHeadRow } from '@company-of-heroes/ui/variants';
	import { COVER_TYPES, formatNumber, protectedTone } from './format';

	type Props = {
		/** Multipliers per cover type (`tp_heavy` → { accuracy: 0.5, … }). */
		cover: Record<string, Record<string, number | undefined>>;
		/** Columns to show, in order; columns that are 1 for every row are left out. */
		columns: { key: string; label: string }[];
		/** Limit to these cover types (e.g. the three classic ones). */
		only?: string[];
		/**
		 * `unit`: the unit itself in cover, so above 1 is good for it (green, like the cover colours).
		 * `weapon`: this weapon against a target in cover, shown as a change (−50%). Both are coloured
		 * for whoever is in cover, so the numbers agree with the cover colours.
		 */
		perspective?: 'unit' | 'weapon';
		/** One line above the table saying what the numbers mean. */
		caption?: string;
		/** Header of the first column. */
		coverLabel?: string;
		class?: string;
	};

	let {
		cover,
		columns,
		only,
		perspective = 'unit',
		caption,
		coverLabel,
		class: className
	}: Props = $props();
	const { t } = useI18n();

	// The in-game cover colours (`art/ui/ingame/cover/cover_decorator_*`).
	const DOT_TONE = {
		green: 'bg-[#94c954]',
		yellow: 'bg-[#ffbb15]',
		red: 'bg-[#ff0000]'
	} as const;

	const rows = $derived(
		COVER_TYPES.filter((type) => cover[type.key] && (!only || only.includes(type.key)))
	);
	const shown = $derived(
		columns.filter((column) => rows.some((row) => (cover[row.key][column.key] ?? 1) !== 1))
	);
	/**
	 * Coloured from the point of view of whoever is in cover, like the cover dots: green is good for
	 * them (more suppression recovery, or less accuracy and damage from the weapon), red is bad.
	 */
	const valueTone = (value: number) =>
		protectedTone(perspective === 'weapon' || value === 1 ? value : 1 / value);
	const valueText = (value: number) => {
		if (perspective === 'unit') {
			return `×${formatNumber(value, 2)}`;
		}

		const change = Math.round((value - 1) * 100);
		return change === 0 ? '—' : `${change > 0 ? '+' : '−'}${Math.abs(change)}%`;
	};
</script>

<!-- A stats table: a cover type per row with the in-game cover colour, multipliers per column. -->
{#if rows.length && shown.length}
	<div class={cn('overflow-x-auto', className)}>
		{#if caption}
			<p class="text-secondary-400 px-4 py-2 text-xs">{caption}</p>
		{/if}
		<table class="w-full border-collapse text-sm">
			<thead>
				<tr class={tableHeadRow}>
					<th class="px-4 py-2 text-left font-semibold">{coverLabel ?? t('Cover')}</th>
					{#each shown as column (column.key)}
						<th class="px-4 py-2 text-right font-semibold">{column.label}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.key)}
					<tr class="border-secondary-800 border-b last:border-b-0">
						<th scope="row" class="px-4 py-2 text-left font-medium text-white">
							<span class="inline-flex items-center gap-2">
								<span
									aria-hidden="true"
									class={cn(
										'size-2.5 shrink-0 rounded-full',
										row.tone ? DOT_TONE[row.tone] : 'bg-secondary-600'
									)}
								></span>
								{t(row.label)}
							</span>
						</th>
						{#each shown as column (column.key)}
							{@const value = cover[row.key][column.key] ?? 1}
							<td class={cn('px-4 py-2 text-right font-semibold tabular-nums', valueTone(value))}>
								{valueText(value)}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
