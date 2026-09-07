<script lang="ts">
	import { watch } from 'runed';
	import { Pagination } from '$lib/components/ui/pagination';
	import { Button } from '$lib/components/ui/button';
	import { List as ReplayList, ListSkeleton as ReplayListSkeleton } from '@company-of-heroes/ui/replay';
	import { api, unwrapApi } from '$core/api';
	import type {
		CommunityMatch,
		CommunityPlayer,
		HistorySortField,
		ReplaysQuery
	} from '@company-of-heroes/api';
	import { getDefaultMapImage, getMapImageFromName, getString } from '$lib/utils/game';
	import { getFactionFlagFromRace } from '$lib/utils';
	import { getMeSteamIds } from '$lib/utils/player-me';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();
	const PER_PAGE = 30;
	const mySteamIds = $derived(getMeSteamIds());

	let items = $state<CommunityMatch[]>([]);
	let page = $state(1);
	let totalItems = $state(0);
	let sort = $state<HistorySortField>('createdAt');
	let sortDir = $state<'asc' | 'desc'>('desc');
	let loading = $state(true);
	let loadToken = $state(0);

	async function load() {
		const token = ++loadToken;
		loading = true;
		try {
			const query: ReplaysQuery = {
				page,
				ranked: false,
				pro: false,
				matchups: [],
				playerIds: [],
				maps: [],
				races: [],
				positions: [],
				elo: null,
				duration: null,
				sort,
				sortDir
			};
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
		() => [page, sort, sortDir] as const,
		() => {
			void load();
		}
	);

	function onSort(field: HistorySortField) {
		if (sort === field) {
			sortDir = sortDir === 'desc' ? 'asc' : 'desc';
			return;
		}

		sort = field;
		sortDir = 'desc';
	}

	function playerHref(player: CommunityPlayer): string | null {
		const id = player.profile?.profile_id;
		if (id != null && id > 0) {
			return `/players/${id}`;
		}

		return player.steamId ? `/players/${player.steamId}` : null;
	}
</script>

<div class="border-secondary-800 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
	<div class="flex flex-wrap items-center gap-3">
		<p class="text-secondary-400 text-sm">
			{t('Public replays uploaded by community members.')}
		</p>
		<Button href="/replays/upload" variant="secondary" size="sm">{t('Upload replay')}</Button>
	</div>
	{#if totalItems > 0}
		<Pagination bind:page perPage={PER_PAGE} count={totalItems} />
	{/if}
</div>

{#if loading && items.length === 0}
	<ReplayListSkeleton
		mapLabel={t('Title')}
		alliesLabel={t('Allies')}
		axisLabel={t('Axis')}
		durationLabel={t('Duration')}
		likesLabel={t('Likes')}
		commentsLabel={t('Comments')}
		downloadsLabel={t('Downloads')}
		dateLabel={t('Date')}
	/>
{:else}
	<ReplayList
		matches={items}
		meSteamIds={mySteamIds}
		{sort}
		{sortDir}
		{onSort}
		replayHref={(id) => `/replays/${id}`}
		{playerHref}
		resolveMapSrc={getMapImageFromName}
		resolveFallbackSrc={getDefaultMapImage}
		resolveFactionFlag={getFactionFlagFromRace}
		formatMapName={(map) => getString(map) || map}
		emptyMessage={t('No member replays found.')}
		mapLabel={t('Title')}
		alliesLabel={t('Allies')}
		axisLabel={t('Axis')}
		durationLabel={t('Duration')}
		likesLabel={t('Likes')}
		commentsLabel={t('Comments')}
		downloadsLabel={t('Downloads')}
		dateLabel={t('Date')}
		sortByLabel={t('Sort by {label}')}
		deletedLabel={t('Deleted')}
	/>
{/if}
