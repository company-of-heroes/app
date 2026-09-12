<script lang="ts">
	import { Button } from '../ui/button';
	import { Select } from '../ui/input';
	import { cn } from '@company-of-heroes/ui/cn';
	import type { HistorySortDir, HistorySortField } from './types';
	import SortAscendingIcon from 'phosphor-svelte/lib/SortAscendingIcon';
	import SortDescendingIcon from 'phosphor-svelte/lib/SortDescendingIcon';

	type Props = {
		sort: HistorySortField;
		sortDir: HistorySortDir;
		onChange: (next: { sort: HistorySortField; sortDir: HistorySortDir }) => void;
		dateLabel?: string;
		likesLabel?: string;
		downloadsLabel?: string;
		commentsLabel?: string;
		ascendingLabel?: string;
		descendingLabel?: string;
		class?: string;
	};

	let {
		sort,
		sortDir,
		onChange,
		dateLabel = 'Date',
		likesLabel = 'Likes',
		downloadsLabel = 'Downloads',
		commentsLabel = 'Comments',
		ascendingLabel = 'Ascending',
		descendingLabel = 'Descending',
		class: className
	}: Props = $props();

	const items = $derived([
		{ value: 'createdAt', label: dateLabel },
		{ value: 'likeCount', label: likesLabel },
		{ value: 'downloadCount', label: downloadsLabel },
		{ value: 'commentCount', label: commentsLabel }
	]);

	function isSortField(value: string): value is HistorySortField {
		return (
			value === 'createdAt' ||
			value === 'likeCount' ||
			value === 'downloadCount' ||
			value === 'commentCount'
		);
	}

	function onFieldChange(value: string | string[] | undefined) {
		const next = Array.isArray(value) ? value[0] : value;
		if (!next || !isSortField(next)) {
			return;
		}

		onChange({
			sort: next,
			sortDir: next === sort ? sortDir : 'desc'
		});
	}

	function toggleDir() {
		onChange({
			sort,
			sortDir: sortDir === 'desc' ? 'asc' : 'desc'
		});
	}
</script>

<div class={cn('flex items-center gap-2', className)}>
	<Select
		type="single"
		value={sort}
		onValueChange={onFieldChange}
		{items}
		size="sm"
		class="w-auto min-w-36"
	/>
	<Button
		type="button"
		variant="secondary"
		size="icon-sm"
		onclick={toggleDir}
		aria-label={sortDir === 'desc' ? descendingLabel : ascendingLabel}
	>
		{#if sortDir === 'desc'}
			<SortDescendingIcon class="size-4" />
		{:else}
			<SortAscendingIcon class="size-4" />
		{/if}
	</Button>
</div>
