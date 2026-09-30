<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
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
		class?: string;
	};

	const { t } = useI18n();

	let { sort, sortDir, onChange, class: className }: Props = $props();

	const items = $derived([
		{ value: 'createdAt', label: t('Date') },
		{ value: 'likeCount', label: t('Likes') },
		{ value: 'downloadCount', label: t('Downloads') },
		{ value: 'commentCount', label: t('Comments') }
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
		aria-label={sortDir === 'desc' ? t('Descending') : t('Ascending')}
	>
		{#if sortDir === 'desc'}
			<SortDescendingIcon class="size-4" />
		{:else}
			<SortAscendingIcon class="size-4" />
		{/if}
	</Button>
</div>
