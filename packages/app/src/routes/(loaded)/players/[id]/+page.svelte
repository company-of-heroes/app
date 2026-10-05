<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { steam } from '$core/steam';
	import { relic } from '$lib/relic';
	import { isSteamId } from '$lib/utils';
	import { resource } from 'runed';
	import * as Player from '$lib/components/player';
	import { PlayerProfile } from '@company-of-heroes/ui/player';
	import PlayerMatchStaffActions from '$lib/components/player/player-match-staff-actions.svelte';
	import { MatchHistoryView } from '$lib/player/match-history-view.svelte';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { PlayerPerformance } from '$lib/components/player-performance';
	import CheaterAlert from '$lib/components/player/cheater-alert.svelte';
	import PlayerScreenshots from '$lib/components/player/player-screenshots.svelte';
	import { loadSmurfAlert } from '$lib/player/smurf';
	import { toPlayerPageData } from '$lib/player/page-data';
	import { findCheaterBySteamId } from '$core/pocketbase/anti-cheat';
	import { account } from '$core/account';
	import { app } from '$core/app/context';
	import { api, unwrapApi } from '$core/api';
	import { getPlayerRating } from '$core/pocketbase/player-ratings';
	import {
		emptyPlayerPerformance,
		getPlayerPerformance
	} from '$core/pocketbase/player-performance';
	import { eloMapForSteamId, mergeEloMaps } from '$lib/utils/player-elo';
	import * as Tabs from '$lib/components/ui/tabs';
	import { labelsForSteamId, loadPlayerLabels } from '$core/pocketbase/player-label-cache.svelte';
	import type { Snapshot } from '@sveltejs/kit';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

	let currentTab = $state('stats');

	const relicProfile = resource(
		() => page.params.id,
		async (id) => {
			if (!id) {
				throw new Error(t('Profile not found'));
			}

			const profile = isSteamId(id)
				? await relic.getProfileBySteamId(id)
				: await relic.getProfileById(parseInt(id, 10));
			if (!profile) {
				throw new Error(t('Profile not found'));
			}

			return profile;
		}
	);

	const steamId = $derived.by(() => {
		const id = page.params.id;
		if (id && isSteamId(id)) {
			return id;
		}

		const name = relicProfile.current?.name;
		return name ? name.replace('/steam/', '') : null;
	});

	const steamProfile = resource(
		() => steamId,
		async (id) => {
			if (!id) {
				return null;
			}

			const [user, game, bans] = await Promise.all([
				steam.getUserProfile(id),
				steam.getRecentlyPlayedGameByAppId(id, 228200),
				steam.getPlayerBans(id).catch(() => [])
			]);
			if (!user) {
				throw new Error(t('Profile not found'));
			}

			return { user, game, bans: bans[0] ?? null };
		}
	);

	// Fast header data loads apart from the slow Relic match history (rank enrichment does
	// sequential personalstat batches), so ELO and votes no longer wait on it.
	const header = resource(
		() => steamId,
		async (id) => {
			if (!id) {
				return null;
			}

			const [playerRating, cheater, likeCount, rewards] = await Promise.all([
				getPlayerRating(id).catch(() => null),
				findCheaterBySteamId(id).catch(() => null),
				app.database.playerSocial.getLikeCount(id),
				unwrapApi(api.rewards.forPlayer(id)).catch(() => null),
				loadPlayerLabels([id])
			]);
			return { steamId: id, playerRating, cheater: !!cheater, likeCount, rewards };
		}
	);

	const customization = resource(
		() => steamId,
		async (id) => {
			if (!id) {
				return null;
			}

			const result = await api.players.getCustomization(id);
			return { steamId: id, value: result.isOk() ? result.value : null };
		}
	);

	afterNavigate(({ from }) => {
		if (from) {
			void customization.refetch();
		}
	});

	const profileKey = $derived.by(() => {
		const profile = relicProfile.current;
		return profile && steamId ? `${steamId}:${profile.profile_id}` : null;
	});

	const smurf = resource(
		() => profileKey,
		async (key) => {
			const profile = relicProfile.current;
			if (!key || !profile || !steamId) {
				return null;
			}

			const value = await loadSmurfAlert(steamId, profile.profile_id).catch(() => null);
			return { key, value };
		}
	);

	const history = resource(
		() => profileKey,
		async (key) => {
			const profile = relicProfile.current;
			if (!key || !profile) {
				return null;
			}

			const matches = await relic
				.getRecentMatchHistoryForProfile(profile.profile_id, { includeHidden: true })
				.catch(() => []);
			return { key, matches };
		}
	);

	const rawMatches = $derived(
		history.current && history.current.key === profileKey ? history.current.matches : null
	);

	const rankedHistory = resource(
		() => rawMatches,
		async (matches) => {
			const profile = relicProfile.current;
			if (!matches || !profile) {
				return null;
			}

			const { enrichMatchHistoryRankLevels } = await import('$lib/player/match-history-ranks');
			const ranked = await enrichMatchHistoryRankLevels(
				matches,
				profile.profile_id,
				profile.leaderboardStats
			);
			return { source: matches, matches: ranked };
		}
	);

	const rankedMatches = $derived(
		rankedHistory.current && rankedHistory.current.source === rawMatches
			? rankedHistory.current.matches
			: null
	);

	const headerData = $derived(header.current?.steamId === steamId ? header.current : null);
	const customizationData = $derived(
		customization.current?.steamId === steamId ? customization.current : null
	);
	const smurfData = $derived(smurf.current?.key === profileKey ? smurf.current : null);

	const profile = $derived(relicProfile.current);
	const user = $derived(steamProfile.current?.user);
	const game = $derived(steamProfile.current?.game);
	const bans = $derived(steamProfile.current?.bans);

	const playerElo = $derived.by(() => {
		if (!profile || !user) {
			return {};
		}

		return mergeEloMaps(
			headerData?.playerRating?.elo,
			eloMapForSteamId(rawMatches ?? [], user.steamid, profile.profile_id)
		);
	});

	const isSelf = $derived.by(() => {
		if (!profile || !user) {
			return false;
		}

		return (
			account.user.steamIds.includes(user.steamid) ||
			app.game.profile?.relic.profile_id === profile.profile_id
		);
	});

	const performanceKey = $derived(
		profile ? `${profile.profile_id}:${isSelf ? `user:${account.userId}` : 'community'}` : null
	);

	const playerPerformance = resource(
		() => performanceKey,
		async (key) => {
			const id = profile?.profile_id;
			const scope = isSelf ? 'user' : 'community';
			const userId = isSelf ? account.userId : null;
			if (!key || !id || (scope === 'user' && !userId)) {
				return { profileId: id, value: emptyPlayerPerformance() };
			}

			const value = await getPlayerPerformance({ profileId: id, scope, userId }).catch(() =>
				emptyPlayerPerformance()
			);
			return { profileId: id, value };
		}
	);

	// Matched on the profile only: when `isSelf` flips after the account loads, the old numbers
	// stay up while the scoped ones load instead of dropping back to the skeleton.
	const performanceData = $derived(
		profile && playerPerformance.current?.profileId === profile.profile_id
			? playerPerformance.current.value
			: null
	);

	const labels = $derived(labelsForSteamId(user?.steamid));

	// Keep the skeleton until everything the header shows has arrived, so the profile renders
	// once instead of shifting per request. The raw Relic history is included because its ratings
	// fill ELO gaps; only the rank enrichment for the match history tab loads afterwards.
	const ready = $derived(
		Boolean(
			profile &&
				user &&
				headerData &&
				customizationData &&
				smurfData &&
				performanceData &&
				rawMatches
		)
	);

	const pagePlayer = $derived.by(() => {
		if (!profile || !user) {
			return null;
		}

		return toPlayerPageData({
			profile,
			user,
			game,
			elo: playerElo,
			performance: performanceData ?? emptyPlayerPerformance(),
			matchHistory: rankedMatches ?? [],
			smurf: smurfData?.value,
			bans,
			labels,
			likeCount: headerData?.likeCount ?? 0,
			customization: customizationData?.value ?? null,
			rewards: headerData?.rewards ?? null
		});
	});

	const matchHistory = new MatchHistoryView(() => pagePlayer);

	export const snapshot: Snapshot<string> = {
		capture: () => currentTab,
		restore: (tab) => (currentTab = tab)
	};
</script>

<SetCrumbs items={[{ label: profile?.alias ?? t('Player') }]} />

{#if !ready || !profile || !user || !pagePlayer}
	<Player.ProfileSkeleton />
{:else}
	<PlayerProfile
		player={matchHistory.player ?? pagePlayer}
		bind:tab={currentTab}
		matchHistoryLoading={!rankedMatches || !matchHistory.ready}
	>
		{#snippet actions()}
			<Player.LabelEditor
				steamId={user.steamid}
				profileId={profile.profile_id}
				alias={profile.alias}
				class="shrink-0"
			/>
			{#if headerData?.cheater}
				<CheaterAlert />
			{/if}
		{/snippet}
		{#snippet performance()}
			<PlayerPerformance
				profileId={profile.profile_id}
				scope={isSelf ? 'user' : 'community'}
				userId={isSelf ? account.userId : undefined}
				performance={performanceData}
				empty={isSelf ? 'self' : 'other'}
				class="rounded-none border-0"
			/>
		{/snippet}
		{#snippet matchActions({ match })}
			<PlayerMatchStaffActions view={matchHistory} {match} />
		{/snippet}
		{#snippet extraTabs()}
			<Tabs.Trigger value="screenshots">{t('Screenshots')}</Tabs.Trigger>
		{/snippet}
		{#snippet extraTabContent()}
			<Tabs.Content value="screenshots">
				<PlayerScreenshots
					steamId={user.steamid}
					userId={isSelf ? account.userId : undefined}
					profileId={profile.profile_id}
				/>
			</Tabs.Content>
		{/snippet}
	</PlayerProfile>
{/if}
