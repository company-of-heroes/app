<script lang="ts">
	import { cn } from '@company-of-heroes/ui/cn';
	import { Input, Select } from '@company-of-heroes/ui/input';
	import { Pagination } from '@company-of-heroes/ui/pagination';
	import {
		List as ReplayList,
		ListSkeleton as ReplayListSkeleton
	} from '@company-of-heroes/ui/replay';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import { useI18n } from '$lib/i18n';
	import { toCommunityMatch } from '$lib/library/community';
	import {
		useReplayLibrary,
		type ReplayPeriod,
		type ReplaySort
	} from '$lib/library/replay-library.svelte';
	import type { FactionKey } from '$lib/library/types';

	const PER_PAGE = 25;

	const { t } = useI18n();
	const library = useReplayLibrary();

	const pageCount = $derived(Math.max(1, Math.ceil(library.filtered.length / PER_PAGE)));
	const page = $derived(Math.min(library.page, pageCount));
	const matches = $derived(
		library.filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(toCommunityMatch)
	);
	const loading = $derived(!library.ready || (library.scanning && library.entries.length === 0));

	const factionItems = $derived([
		{ value: 'all', label: t('All factions') },
		{ value: 'allies', label: t('Americans') },
		{ value: 'allies_commonwealth', label: t('British') },
		{ value: 'axis', label: t('Wehrmacht') },
		{ value: 'axis_panzer_elite', label: t('Panzer Elite') }
	]);
	const mapItems = $derived([{ value: 'all', label: t('All maps') }, ...library.maps]);
	const periodItems = $derived([
		{ value: 'all', label: t('Any time') },
		{ value: 'week', label: t('Last 7 days') },
		{ value: 'month', label: t('Last 30 days') },
		{ value: 'year', label: t('Last year') }
	]);
	const sortItems = $derived([
		{ value: 'newest', label: t('Newest first') },
		{ value: 'oldest', label: t('Oldest first') },
		{ value: 'longest', label: t('Longest first') },
		{ value: 'name', label: t('Name') }
	]);
	const emptyMessage = $derived(
		library.entries.length === 0
			? t('No replays found in this folder.')
			: t('No replays match these filters.')
	);

	/** Every filter change starts again at page 1. */
	function filter(apply: () => void) {
		apply();
		library.page = 1;
	}
</script>

{#snippet pagination()}
	<Pagination
		class="ms-auto shrink-0"
		{page}
		count={library.filtered.length}
		perPage={PER_PAGE}
		pageNumberLabel={t('Page number')}
		onPage={(next) => (library.page = next)}
	/>
{/snippet}

<div class="flex min-h-full flex-col">
	<div class="border-secondary-800 flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
		<h1 class="font-heading text-xl font-bold text-white">{t('Replays')}</h1>
		<span class="text-secondary-400 text-sm tabular-nums">
			{t('{count} of {total} replays', {
				count: library.filtered.length,
				total: library.entries.length
			})}
		</span>
		{#if library.filtered.length > PER_PAGE}
			{@render pagination()}
		{/if}
	</div>
	<div class="border-secondary-800 flex flex-wrap items-center gap-2 border-b px-4 py-2">
		<Input
			value={library.query}
			oninput={(event) => filter(() => (library.query = event.currentTarget.value))}
			placeholder={t('Search player, map or name')}
			aria-label={t('Search player, map or name')}
			size="sm"
			class="min-w-56 grow basis-56"
		>
			{#snippet leading()}
				<MagnifyingGlassIcon class="size-4" />
			{/snippet}
		</Input>
		<Select
			type="single"
			size="sm"
			class="w-44"
			items={factionItems}
			bind:value={
				() => library.faction,
				(value) => filter(() => (library.faction = value as FactionKey | 'all'))
			}
			aria-label={t('Faction')}
		/>
		<Select
			type="single"
			size="sm"
			class="w-52"
			items={mapItems}
			bind:value={() => library.map, (value) => filter(() => (library.map = value))}
			aria-label={t('Map')}
		/>
		<Select
			type="single"
			size="sm"
			class="w-40"
			items={periodItems}
			bind:value={
				() => library.period, (value) => filter(() => (library.period = value as ReplayPeriod))
			}
			aria-label={t('Period')}
		/>
		<Select
			type="single"
			size="sm"
			class="w-44"
			items={sortItems}
			bind:value={() => library.sort, (value) => (library.sort = value as ReplaySort)}
			aria-label={t('Sort')}
		/>
	</div>
	<div class="min-w-0 flex-1 overflow-x-hidden">
		{#if loading}
			<ReplayListSkeleton />
		{:else}
			<div class={cn(matches.length > 0 && 'border-secondary-800/70 border-b')}>
				<ReplayList
					{matches}
					sort="createdAt"
					sortDir="desc"
					onSort={() => {}}
					{emptyMessage}
					mapLabel={t('Replay')}
					showEngagement={false}
				/>
			</div>
		{/if}
	</div>
	{#if library.filtered.length > PER_PAGE}
		<div class="border-secondary-800 flex border-t px-5 py-3">
			{@render pagination()}
		</div>
	{/if}
</div>
