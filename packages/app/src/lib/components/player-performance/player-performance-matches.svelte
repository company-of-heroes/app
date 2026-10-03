<script lang="ts">
	import { app } from '$core/app/context';
	import type { MatchExpanded } from '$core/app/database/matches';
	import type { PerformanceScope } from '$core/pocketbase/player-performance';
	import { Button } from '$lib/components/ui/button';
	import { MatchListTable } from '$lib/components/match';
	import { watch } from 'runed';
	import { useI18n } from '$lib/i18n';
	import { dev } from '$app/environment';

	type Props = {
		profileId: number;
		scope: PerformanceScope;
		userId?: string | null;
		totalGames?: number;
		maps?: string[];
		races?: number[];
		matchtypes?: number[];
		showMap?: boolean;
		label: string;
		emptyMessage?: string;
	};

	const PER_PAGE = 25;

	let {
		profileId,
		scope,
		userId = null,
		totalGames = 0,
		maps = [],
		races = [],
		matchtypes = [],
		showMap = true,
		label,
		emptyMessage = 'No matches found.'
	}: Props = $props();
	const { t } = useI18n();

	const highlightedPlayers = $derived([String(profileId)]);
	const hasFilter = $derived(maps.length > 0 || races.length > 0 || matchtypes.length > 0);

	let page = $state(1);
	let allMatches = $state<MatchExpanded[]>([]);
	let totalItems = $state(0);
	let initialLoading = $state(true);
	let loadingMore = $state(false);

	async function fetchMatches(pageNum: number) {
		if (!profileId || !hasFilter) {
			return { items: [], totalItems: 0 };
		}

		if (scope === 'user' && !userId) {
			return { items: [], totalItems: 0 };
		}

		const playerIds = scope === 'community' ? [String(profileId)] : [];

		return app.database.matches.getHistoryList(pageNum, PER_PAGE, {
			scope,
			userId: userId ?? undefined,
			profileId,
			// Same games the totals count: this profile only, ranked unless a mode was picked.
			profileOnly: scope === 'user',
			ranked: matchtypes.length === 0,
			maps,
			races: races.map(String),
			matchtypes,
			exactMatchtypes: matchtypes.length > 0,
			playerIds,
			includeSkirmish: dev
		});
	}

	watch(
		() =>
			[
				profileId,
				scope,
				userId ?? null,
				maps.join(','),
				races.join(','),
				matchtypes.join(',')
			] as const,
		([nextProfileId, nextScope, nextUserId, nextMaps, nextRaces, nextMatchtypes]) => {
			page = 1;
			allMatches = [];
			totalItems = 0;
			initialLoading = true;

			const ready =
				nextProfileId &&
				(nextMaps || nextRaces || nextMatchtypes) &&
				!(nextScope === 'user' && !nextUserId);

			if (!ready) {
				initialLoading = false;
				return;
			}

			void (async () => {
				try {
					const result = await fetchMatches(1);
					allMatches = result.items;
					totalItems = result.totalItems;
				} catch (error) {
					console.warn('[player-performance] matches failed:', error);
				} finally {
					initialLoading = false;
				}
			})();
		}
	);

	async function loadMore() {
		if (loadingMore || !hasMore) {
			return;
		}

		loadingMore = true;
		try {
			const nextPage = page + 1;
			const result = await fetchMatches(nextPage);
			const existingIds = new Set(allMatches.map((match) => match.id));
			const newItems = result.items.filter((match) => !existingIds.has(match.id));
			allMatches = [...allMatches, ...newItems];
			totalItems = result.totalItems;
			page = nextPage;
		} catch (error) {
			console.warn('[player-performance] load more failed:', error);
		} finally {
			loadingMore = false;
		}
	}

	const totalCount = $derived(Math.max(totalItems, totalGames));
	const hasMore = $derived(allMatches.length > 0 && allMatches.length < totalCount);
</script>

{#snippet loadMoreFooter()}
	{#if hasMore}
		<div class="flex flex-col items-center gap-2 px-4 pt-2 pb-3">
			<p class="text-secondary-500 text-xs">
				{t('Showing {shown} of {total} matches {label}', {
					shown: allMatches.length,
					total: totalCount,
					label
				})}
			</p>
			<Button variant="secondary" size="sm" loading={loadingMore} onclick={() => loadMore()}>
				{t('Load more')}
			</Button>
		</div>
	{/if}
{/snippet}

<MatchListTable
	matches={allMatches}
	loading={initialLoading}
	{showMap}
	showRating
	{highlightedPlayers}
	emptyMessage={t(emptyMessage)}
	class="bg-gray-950/90"
	footer={loadMoreFooter}
/>
