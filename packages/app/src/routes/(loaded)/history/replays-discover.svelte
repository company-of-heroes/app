<script module lang="ts">
	import type { ReplayDiscoverData } from '@company-of-heroes/ui/replay-browse';

	/** Last Discover load, shown at once when the tab opens again while it refreshes. */
	let lastDiscover: ReplayDiscoverData | null = null;
</script>

<script lang="ts">
	import { resource } from 'runed';
	import type { CommunityMatch, ReplaysQuery } from '@company-of-heroes/ui/replay';
	import {
		DiscoverView,
		themeArchiveQuery,
		type DiscoverThemeId
	} from '@company-of-heroes/ui/replay-browse';
	import { api, unwrapApi } from '$core/api';
	import { getMeSteamIds } from '$lib/utils/player-me';
	import { useI18n } from '$lib/i18n';
	import { historyListHref } from '$core/app/features/history/history-url';

	const SHARED_PER_PAGE = 12;

	const { t } = useI18n();
	const mySteamIds = $derived(getMeSteamIds());

	const discover = resource(
		() => true,
		async (): Promise<ReplayDiscoverData | null> => {
			const result = await api.replays.discover();
			if (result.isErr()) {
				console.error('[REPLAYS]: discover failed:', result.error);
				return lastDiscover;
			}

			lastDiscover = result.value as ReplayDiscoverData;
			return lastDiscover;
		},
		{ initialValue: lastDiscover }
	);

	// Signed out (401) or offline: no suggestions, the strip stays hidden.
	const candidates = resource(
		() => true,
		async (): Promise<CommunityMatch[] | null> => {
			const result = await api.replays.shareCandidates();
			return result.isOk() ? (result.value as CommunityMatch[]) : null;
		},
		{ initialValue: null }
	);

	const emptyQuery = (page: number): ReplaysQuery => ({
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
		filter: null,
		sort: 'createdAt',
		sortDir: 'desc'
	});

	function themeHref(theme: DiscoverThemeId) {
		const query = { ...emptyQuery(1), ...themeArchiveQuery(theme) };
		return historyListHref(
			{
				page: 1,
				sort: query.sort,
				sortDir: query.sortDir,
				filters: {
					playerIds: [],
					maps: [],
					races: [],
					matchups: query.matchups,
					positions: [],
					ranked: query.ranked,
					pro: query.pro,
					duration: query.duration ?? undefined
				}
			},
			'community'
		);
	}

	async function loadMoreShared(page: number) {
		return unwrapApi(api.replays.getMemberHistory(emptyQuery(page), SHARED_PER_PAGE));
	}
</script>

{#if discover.error && !discover.current}
	<p class="text-secondary-400 px-4 py-12 text-center text-sm">
		{t('Failed to load community replays. Please try again later.')}
	</p>
{:else}
	<DiscoverView
		data={discover.current}
		shareCandidates={candidates.current}
		shareHref={(match) => `/replays/upload?fromMatch=${match.id}`}
		{themeHref}
		{loadMoreShared}
		uploadHref="/replays/upload"
		meSteamIds={mySteamIds}
	/>
{/if}
