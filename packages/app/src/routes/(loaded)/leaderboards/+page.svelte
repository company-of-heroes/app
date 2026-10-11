<script module lang="ts">
	import { createTtlCache } from '@company-of-heroes/api';
	import { relic } from '$lib/relic';

	type BoardStats = Awaited<ReturnType<typeof relic.getLeaderboard>>;

	/** Last loaded rows per board, shown at once on a tab switch while the board refreshes. */
	const boardCache = createTtlCache<BoardStats>({ ttlMs: 120_000 });
</script>

<script lang="ts">
	import type { Snapshot } from '@sveltejs/kit';
	import { resource, useDebounce, watch } from 'runed';
	import { SvelteSet } from 'svelte/reactivity';
	import { ToggleGroup } from '$lib/components/ui/toggle-group';
	import { getRaceLabelFromLeaderboardId } from '$lib/components/leaderboard/leaderboard-utils';
	import {
		LEADERBOARD_PAGE_SIZE,
		LeaderboardList,
		LeaderboardPodium,
		LeaderboardSkeleton
	} from '@company-of-heroes/ui/leaderboard';
	import type { LeaderboardStatRow } from '@company-of-heroes/ui/format/types';
	import { getSteamIdFromProfile } from '$lib/utils/leaderboard-resolvers';
	import {
		getPlayerRatings,
		harvestPlayerRatingsForProfiles,
		selectLeaderboardHarvestProfileIds,
		type PlayerRatingRecord
	} from '$core/pocketbase/player-ratings';
	import { leaderboards } from '$lib/utils/game';
	import { Input } from '$lib/components/ui/input';
	import { isEmpty } from 'lodash-es';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlassIcon';
	import { useI18n } from '$lib/i18n';
	import { steam, type SteamPlayerSummary } from '$core/steam';
	import {
		labelsForSteamId,
		preloadPlayerLabels
	} from '$core/pocketbase/player-label-cache.svelte';
	import {
		likeCountForSteamId,
		preloadPlayerLikeCounts
	} from '$core/pocketbase/player-vote-cache.svelte';

	let leaderboardId = $state(leaderboards[0].value);
	let leaderboardFactionId = $state(leaderboards[0].leaderboardFationIds[0].value);
	let searchInput = $state('');
	let debouncedSearch = $state('');
	let listLimit = $state(LEADERBOARD_PAGE_SIZE);
	let ratings = $state.raw(new Map<string, PlayerRatingRecord>());
	let ratingsPending = $state(0);
	const requestedRatings = new SvelteSet<string>();
	const harvestedProfiles = new SvelteSet<string>();
	const { t } = useI18n();

	let leaderboardFactionsIds = $derived(
		leaderboards.find((lb) => lb.value === leaderboardId)!.leaderboardFationIds!
	);
	let activeModeLabel = $derived.by(() => {
		const mode = leaderboards.find((lb) => lb.value === leaderboardId)?.label ?? '';
		const faction = getRaceLabelFromLeaderboardId(parseInt(leaderboardFactionId, 10));
		return `${mode} · ${faction}`;
	});

	const statsResource = resource(
		() => leaderboardFactionId,
		async (factionId) => {
			const stats = await relic.getLeaderboard(parseInt(factionId, 10));
			boardCache.invalidate(factionId);
			boardCache.getOrLoad(factionId, () => stats);
			return { factionId, stats };
		},
		{
			initialValue: { factionId: '', stats: [] as BoardStats }
		}
	);

	const boardStats = $derived(
		statsResource.current.factionId === leaderboardFactionId
			? statsResource.current.stats
			: boardCache.peek(leaderboardFactionId)
	);
	const showSkeleton = $derived(boardStats === undefined && statsResource.loading);

	const filteredStats = $derived.by(() => {
		const query = debouncedSearch.trim().toLowerCase();
		const stats = boardStats ?? [];

		if (!query || isEmpty(query)) {
			return stats;
		}

		return stats.filter(
			(stat) =>
				stat.profile?.alias.toLowerCase().startsWith(query) ||
				stat.profile?.alias.toLowerCase().includes(query)
		);
	});

	const isSearching = $derived(debouncedSearch.trim().length > 0);
	/** Podium plus the list rows on screen; ratings, Steam, labels and likes load for these only. */
	const renderedStats = $derived(filteredStats.slice(0, (isSearching ? 0 : 3) + listLimit));
	const renderedSteamIds = $derived(
		renderedStats.map((stat) => getSteamIdFromProfile(stat.profile)).filter(Boolean)
	);

	const steamProfiles = resource(
		() => renderedSteamIds.join(','),
		async () => {
			if (renderedSteamIds.length === 0) {
				return {} as Record<string, SteamPlayerSummary>;
			}

			const profiles = await steam.getUserProfiles(renderedSteamIds);
			return Object.fromEntries(profiles.map((profile) => [profile.steamid, profile]));
		},
		{ initialValue: {} as Record<string, SteamPlayerSummary> }
	);

	const eloBySteamId = $derived(
		Object.fromEntries([...ratings].map(([steamId, record]) => [steamId, record.elo]))
	);

	const enrichedStats: LeaderboardStatRow[] = $derived.by(() => {
		return filteredStats.map((stat) => {
			const steamId = getSteamIdFromProfile(stat.profile);
			return {
				leaderboard_id: stat.leaderboard_id,
				rank: stat.rank,
				ranklevel: stat.ranklevel,
				wins: stat.wins,
				losses: stat.losses,
				streak: stat.streak,
				profile: {
					profile_id: stat.profile.profile_id,
					alias: stat.profile.alias,
					country: stat.profile.country,
					name: stat.profile.name,
					avatarUrl: steamProfiles.current[steamId]?.avatarfull,
					labels: labelsForSteamId(steamId),
					likeCount: likeCountForSteamId(steamId) ?? 0
				}
			};
		});
	});

	let podiumStats = $derived(isSearching ? [] : enrichedStats.slice(0, 3));
	let listStats = $derived(isSearching ? enrichedStats : enrichedStats.slice(3));

	const searchPlayer = useDebounce(
		() => {
			debouncedSearch = searchInput;
		},
		() => 250
	);

	/** Loads the ratings not asked for yet (or all of `steamIds` on refresh) into `ratings`. */
	async function loadRatings(steamIds: string[], options: { refresh?: boolean } = {}) {
		const ids = options.refresh ? steamIds : steamIds.filter((id) => !requestedRatings.has(id));
		if (ids.length === 0) {
			return;
		}

		for (const id of ids) {
			requestedRatings.add(id);
		}

		ratingsPending += 1;
		try {
			const loaded = await getPlayerRatings(ids);
			ratings = new Map([...ratings, ...loaded]);
		} catch (error) {
			console.error('[LEADERBOARD]: ratings failed:', error);
			for (const id of ids) {
				requestedRatings.delete(id);
			}
		} finally {
			ratingsPending -= 1;
		}
	}

	watch(
		() => leaderboardId,
		() => {
			const factions = leaderboards.find((lb) => lb.value === leaderboardId)!.leaderboardFationIds;
			if (!factions.some((faction) => faction.value === leaderboardFactionId)) {
				leaderboardFactionId = factions[0].value;
			}
		}
	);

	watch(
		() => [leaderboardFactionId, debouncedSearch],
		() => {
			listLimit = LEADERBOARD_PAGE_SIZE;
		},
		{ lazy: true }
	);

	watch(
		() => renderedSteamIds,
		(steamIds) => {
			preloadPlayerLabels(steamIds);
			preloadPlayerLikeCounts(steamIds);
			void loadRatings(steamIds);
		}
	);

	watch(
		() => [leaderboardFactionId, renderedStats, ratings, ratingsPending] as const,
		([factionId, stats, ratingsBySteamId, pending]) => {
			if (stats.length === 0 || pending > 0 || statsResource.current.factionId !== factionId) {
				return;
			}

			const steamByProfile: Record<number, string> = {};
			for (const stat of stats) {
				const steamId = getSteamIdFromProfile(stat.profile);
				if (steamId) {
					steamByProfile[stat.profile.profile_id] = steamId;
				}
			}

			const profileIds = selectLeaderboardHarvestProfileIds({
				stats: stats.filter(
					(stat) => !harvestedProfiles.has(`${factionId}:${stat.profile.profile_id}`)
				),
				leaderboardId: parseInt(factionId, 10),
				ratingsBySteamId,
				steamIdForProfile: (profileId) => steamByProfile[profileId] ?? null
			});

			if (profileIds.length === 0) {
				return;
			}

			for (const profileId of profileIds) {
				harvestedProfiles.add(`${factionId}:${profileId}`);
			}

			void harvestPlayerRatingsForProfiles(profileIds).then((result) => {
				if (!result || result.processed === 0) {
					return;
				}

				const steamIds = profileIds
					.map((profileId) => steamByProfile[profileId])
					.filter((steamId): steamId is string => Boolean(steamId));
				void loadRatings(steamIds, { refresh: true });
			});
		}
	);

	export const snapshot: Snapshot<[string, string]> = {
		capture: () => [leaderboardFactionId, leaderboardId],
		restore: ([factionId, id]) => {
			leaderboardId = id;
			leaderboardFactionId = factionId;
		}
	};
</script>

<div
	class="border-secondary-800 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b p-4"
>
	<div class="flex flex-wrap items-center gap-4">
		<ToggleGroup bind:value={leaderboardId} items={leaderboards} class="w-fit" />
		<ToggleGroup bind:value={leaderboardFactionId} items={leaderboardFactionsIds} class="w-fit" />
		<p class="text-secondary-400 text-sm">{activeModeLabel}</p>
	</div>
	<Input
		type="text"
		placeholder={t('Search player...')}
		class="w-full flex-none sm:w-56"
		bind:value={searchInput}
		oninput={() => searchPlayer()}
	>
		{#snippet leading()}
			<MagnifyingGlassIcon class="size-4" />
		{/snippet}
	</Input>
</div>

{#if showSkeleton}
	<LeaderboardSkeleton />
{:else}
	{#if !isSearching}
		<LeaderboardPodium stats={podiumStats} {eloBySteamId} />
	{/if}

	<LeaderboardList
		bind:limit={listLimit}
		stats={listStats}
		{eloBySteamId}
		emptyMessage={filteredStats.length === 0
			? t('No players found.')
			: t('No more players to show.')}
	/>
{/if}
