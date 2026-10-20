<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import { cn } from '@company-of-heroes/ui/cn';
	import { pageTab } from '@company-of-heroes/ui/variants';
	import CrownIcon from 'phosphor-svelte/lib/CrownIcon';
	import FunnelSimpleIcon from 'phosphor-svelte/lib/FunnelSimpleIcon';
	import RankingIcon from 'phosphor-svelte/lib/RankingIcon';
	import { Button } from '../ui/button';
	import ReplaySort from '../replay/replay-sort.svelte';
	import type {
		HistoryMatchup,
		HistorySortDir,
		HistorySortField,
		ReplayLayout
	} from '../replay/types';
	import LayoutToggle from './layout-toggle.svelte';
	import type { ArchiveQuickFilters } from './types';

	type Props = {
		value: ArchiveQuickFilters;
		onChange: (next: ArchiveQuickFilters) => void;
		sort: HistorySortField;
		sortDir: HistorySortDir;
		onSortChange: (next: { sort: HistorySortField; sortDir: HistorySortDir }) => void;
		/** Opens the full filter sheet. */
		onOpenFilters: () => void;
		/** Filters beyond the chips are set (dot on the Filters button). */
		advancedActive?: boolean;
		/** Grid or list; the toggle shows only with `onLayoutChange`. */
		layout?: ReplayLayout;
		onLayoutChange?: (next: ReplayLayout) => void;
	};

	const MATCHUPS: HistoryMatchup[] = ['1v1', '2v2', '3v3', '4v4'];

	const { t } = useI18n();

	let {
		value,
		onChange,
		sort,
		sortDir,
		onSortChange,
		onOpenFilters,
		advancedActive = false,
		layout = 'grid',
		onLayoutChange
	}: Props = $props();

	/** One matchup at a time, like a switch; All clears it. */
	function selectMatchup(matchup: HistoryMatchup) {
		onChange({ ...value, matchups: [matchup] });
	}

	const chip = cn(pageTab, 'h-8 px-3 text-sm');
</script>

<div
	class="border-secondary-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2.5"
>
	<div
		class="flex min-w-0 flex-wrap items-center gap-1.5"
		role="group"
		aria-label={t('Quick filters')}
	>
		<button
			type="button"
			class={chip}
			data-state={value.matchups.length === 0 ? 'on' : undefined}
			aria-pressed={value.matchups.length === 0}
			onclick={() => onChange({ ...value, matchups: [] })}
		>
			{t('All')}
		</button>
		{#each MATCHUPS as matchup (matchup)}
			{@const on = value.matchups.length === 1 && value.matchups[0] === matchup}
			<button
				type="button"
				class={chip}
				data-state={on ? 'on' : undefined}
				aria-pressed={on}
				onclick={() => selectMatchup(matchup)}
			>
				{matchup}
			</button>
		{/each}
		<span class="bg-secondary-800 mx-1.5 h-5 w-px" aria-hidden="true"></span>
		<button
			type="button"
			class={chip}
			data-state={value.ranked ? 'on' : undefined}
			aria-pressed={value.ranked}
			onclick={() => onChange({ ...value, ranked: !value.ranked })}
		>
			<RankingIcon class="size-4" weight="duotone" />
			{t('Ranked')}
		</button>
		<button
			type="button"
			class={chip}
			data-state={value.pro ? 'on' : undefined}
			aria-pressed={value.pro}
			onclick={() => onChange({ ...value, pro: !value.pro })}
		>
			<CrownIcon class="size-4" weight="duotone" />
			{t('Pro')}
		</button>
	</div>
	<div class="flex shrink-0 items-center gap-2">
		{#if onLayoutChange}
			<LayoutToggle value={layout} onChange={onLayoutChange} />
		{/if}
		<ReplaySort {sort} {sortDir} onChange={onSortChange} />
		<Button variant="secondary" size="sm" onclick={onOpenFilters}>
			<span class="relative inline-flex">
				<FunnelSimpleIcon class="size-4" />
				{#if advancedActive}
					<span
						class="bg-primary absolute -end-0.5 -top-0.5 size-1.5 rounded-full"
						aria-hidden="true"
					></span>
				{/if}
			</span>
			{t('Filters')}
		</Button>
	</div>
</div>
