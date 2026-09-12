<script lang="ts">
	import { watch } from 'runed';
	import { Pagination } from '$lib/components/ui/pagination';
	import { Button } from '$lib/components/ui/button';
	import { Sheet } from '@company-of-heroes/ui/sheet';
	import {
		Filters,
		List as ReplayList,
		ListSkeleton as ReplayListSkeleton,
		Sort,
		type ReplaysQuery
	} from '@company-of-heroes/ui/replay';
	import { api, unwrapApi } from '$core/api';
	import { app } from '$core/app/context';
	import type { CommunityMatch, CommunityPlayer, HistorySortField } from '@company-of-heroes/api';
	import { getDefaultMapImage, getMapImageFromName, getString } from '$lib/utils/game';
	import { getFactionFlagFromRace, getRankImage } from '$lib/utils';
	import { getMeSteamIds } from '$lib/utils/player-me';
	import { useI18n } from '$lib/i18n';
	import FunnelSimpleIcon from 'phosphor-svelte/lib/FunnelSimpleIcon';
	import UploadSimpleIcon from 'phosphor-svelte/lib/UploadSimpleIcon';

	type Props = {
		query: ReplaysQuery;
	};

	let { query = $bindable() }: Props = $props();
	const { t } = useI18n();
	const PER_PAGE = 30;
	const mySteamIds = $derived(getMeSteamIds());
	let filtersOpen = $state(false);
	const filtersActive = $derived(query.filter != null);

	let items = $state<CommunityMatch[]>([]);
	let totalItems = $state(0);
	let loading = $state(true);
	let loadToken = $state(0);

	const labels = $derived({
		ranked: t('Ranked'),
		proGames: t('Pro games'),
		players: t('Players'),
		maps: t('Maps'),
		faction: t('Faction'),
		gameMode: t('Game mode'),
		position: t('Position'),
		elo: t('ELO'),
		duration: t('Duration'),
		selectPlayers: t('Select players'),
		selectMaps: t('Select maps'),
		selectFactions: t('Select factions'),
		selectGameModes: t('Select game modes'),
		selectPositions: t('Select positions'),
		changeOperator: t('Change operator'),
		minutes: t('min'),
		clearFilters: t('Clear filters'),
		apply: t('Apply'),
		addCondition: t('Add condition'),
		and: t('And'),
		or: t('Or'),
		contains: t('Contains'),
		equals: t('Equals'),
		is: t('Is'),
		removeCondition: t('Remove condition'),
		trueLabel: t('True'),
		falseLabel: t('False')
	});

	async function load() {
		const token = ++loadToken;
		loading = true;
		try {
			const result = await unwrapApi(api.replays.getMemberHistory(query, PER_PAGE));
			if (token !== loadToken) {
				return;
			}

			items = result.items;
			totalItems = result.totalItems;
		} catch (error) {
			console.error(error);
			if (token !== loadToken) {
				return;
			}

			items = [];
			totalItems = 0;
		} finally {
			if (token === loadToken) {
				loading = false;
			}
		}
	}

	watch(
		() => $state.snapshot(query),
		() => {
			void load();
		}
	);

	function apply(patch: Partial<ReplaysQuery>) {
		query = {
			...query,
			...patch,
			page: patch.page ?? 1
		};
	}

	function onSort(field: HistorySortField) {
		if (query.sort === field) {
			apply({
				sort: field,
				sortDir: query.sortDir === 'desc' ? 'asc' : 'desc'
			});
			return;
		}

		apply({ sort: field, sortDir: 'desc' });
	}

	function playerHref(player: CommunityPlayer): string | null {
		const id = player.profile?.profile_id;
		if (id != null && id > 0) {
			return `/players/${id}`;
		}

		return player.steamId ? `/players/${player.steamId}` : null;
	}

	async function searchPlayers(q: string) {
		const items = await app.database.matches.searchHistoryPlayers('community', q);
		return items.map((player) => ({
			value: String(player.profile_id),
			label: (player.alias || '').trim() || String(player.profile_id)
		}));
	}

	async function searchMaps(q: string) {
		const items = await app.database.matches.searchHistoryMaps('community', q);
		return items.map((item) => ({
			value: item.map,
			label: item.name || item.map
		}));
	}
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<div
		class="border-secondary-800 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
	>
		<div class="min-w-0">
			<p class="font-medium text-white">{t('Share your replay')}</p>
			<p class="text-secondary-400 mt-0.5 text-sm">
				{t('Upload a .rec file to Member replays so others can watch your games.')}
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<Button href="/replays/upload" variant="primary">
				<UploadSimpleIcon class="size-4" />
				{t('Upload replay')}
			</Button>
			{#if totalItems > 0}
				<Pagination
					page={query.page}
					perPage={PER_PAGE}
					count={totalItems}
					onPage={(page) => apply({ page })}
				/>
			{/if}
		</div>
	</div>
	<div class="border-secondary-800 flex items-center justify-end gap-2 border-b px-4 py-2">
		<Sort
			sort={query.sort}
			sortDir={query.sortDir}
			onChange={({ sort, sortDir }) => apply({ sort, sortDir })}
			dateLabel={t('Date')}
			likesLabel={t('Likes')}
			downloadsLabel={t('Downloads')}
			commentsLabel={t('Comments')}
			ascendingLabel={t('Ascending')}
			descendingLabel={t('Descending')}
		/>
		<Button variant="secondary" size="sm" onclick={() => (filtersOpen = true)}>
			<span class="relative inline-flex">
				<FunnelSimpleIcon class="size-4" />
				{#if filtersActive}
					<span
						class="bg-primary absolute -end-0.5 -top-0.5 size-1.5 rounded-full"
						aria-hidden="true"
					></span>
				{/if}
			</span>
			{t('Filters')}
		</Button>
	</div>

	<div class="min-w-0 flex-1 overflow-auto">
		{#if loading && items.length === 0}
			<ReplayListSkeleton
				mapLabel={t('Title')}
				typeLabel={t('Type')}
				alliesLabel={t('Allies')}
				axisLabel={t('Axis')}
				durationLabel={t('Duration')}
				dateLabel={t('Date')}
			/>
		{:else}
			<ReplayList
				matches={items}
				highlightedPlayers={query.playerIds}
				meSteamIds={mySteamIds}
				sort={query.sort}
				sortDir={query.sortDir}
				{onSort}
				replayHref={(id) => `/replays/${id}`}
				{playerHref}
				resolveMapSrc={getMapImageFromName}
				resolveFallbackSrc={getDefaultMapImage}
				resolveFactionFlag={getFactionFlagFromRace}
				getRankImage={getRankImage}
				formatMapName={(map) => getString(map) || map}
				emptyMessage={t('No member replays found.')}
				mapLabel={t('Title')}
				typeLabel={t('Type')}
				alliesLabel={t('Allies')}
				axisLabel={t('Axis')}
				durationLabel={t('Duration')}
				likesLabel={t('Likes')}
				commentsLabel={t('Comments')}
				downloadsLabel={t('Downloads')}
				dateLabel={t('Date')}
				sortByLabel={t('Sort by {label}')}
				deletedLabel={t('Deleted')}
				proLabel={t('Pro')}
				proTooltipLabel={(elo) => t('Pro gameplay · avg {elo} ELO', { elo })}
			/>
		{/if}
	</div>
</div>

<Sheet bind:open={filtersOpen} side="left" title={t('Filters')} closeLabel={t('Close')}>
	<Filters
		{query}
		maps={[]}
		onChange={apply}
		{labels}
		onSearchPlayers={searchPlayers}
		onSearchMaps={searchMaps}
	/>
</Sheet>
