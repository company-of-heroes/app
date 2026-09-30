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
	import { api } from '$core/api';
	import { getPlayerRating } from '$core/pocketbase/player-ratings';
	import {
		emptyPlayerPerformance,
		getPlayerPerformance
	} from '$core/pocketbase/player-performance';
	import { eloMapForSteamId, mergeEloMaps } from '$lib/utils/player-elo';
	import * as Tabs from '$lib/components/ui/tabs';
	import {
		labelsForSteamId,
		preloadPlayerLabels
	} from '$core/pocketbase/player-label-cache.svelte';
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

			const [user, game] = await Promise.all([
				steam.getUserProfile(id),
				steam.getRecentlyPlayedGameByAppId(id, 228200)
			]);
			if (!user) {
				throw new Error(t('Profile not found'));
			}

			return { user, game };
		}
	);

	const extras = resource(
		() => {
			const profile = relicProfile.current;
			const id = steamId;
			return profile && id ? `${id}:${profile.profile_id}` : null;
		},
		async (key) => {
			const profile = relicProfile.current;
			const id = steamId;
			if (!key || !profile || !id) {
				return null;
			}

			const [matchHistoryRaw, playerRating, cheater, smurf, likeCount] = await Promise.all([
				relic.getRecentMatchHistoryForProfile(profile.profile_id, {
					includeHidden: true
				}),
				getPlayerRating(id),
				findCheaterBySteamId(id),
				loadSmurfAlert(id, profile.profile_id),
				app.database.playerSocial.getLikeCount(id)
			]);
			const { enrichMatchHistoryRankLevels } = await import('$lib/player/match-history-ranks');
			const matchHistory = await enrichMatchHistoryRankLevels(
				matchHistoryRaw,
				profile.profile_id,
				profile.leaderboardStats
			);
			return {
				key,
				matchHistory,
				playerRating,
				cheater: !!cheater,
				smurf,
				likeCount
			};
		}
	);

	const customization = resource(
		() => steamId,
		async (id) => {
			if (!id) {
				return null;
			}

			const result = await api.players.getCustomization(id);
			return result.isOk() ? result.value : null;
		}
	);

	afterNavigate(({ from }) => {
		if (from) {
			void customization.refetch();
		}
	});

	const extra = $derived.by(() => {
		const current = extras.current;
		const profile = relicProfile.current;
		const id = steamId;
		if (!current || !profile || !id) {
			return null;
		}

		if (current.key !== `${id}:${profile.profile_id}`) {
			return null;
		}

		return current;
	});

	const profile = $derived(relicProfile.current);
	const user = $derived(steamProfile.current?.user);
	const game = $derived(steamProfile.current?.game);

	const playerElo = $derived.by(() => {
		if (!profile || !user) {
			return {};
		}

		return mergeEloMaps(
			extra?.playerRating?.elo,
			eloMapForSteamId(extra?.matchHistory ?? [], user.steamid, profile.profile_id)
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

	const playerPerformance = resource(
		[
			() => profile?.profile_id ?? null,
			() => (isSelf ? 'user' : 'community'),
			() => (isSelf ? account.userId : null)
		],
		async ([id, scope, userId]) => {
			if (!id) {
				return emptyPlayerPerformance();
			}

			if (scope === 'user' && !userId) {
				return emptyPlayerPerformance();
			}

			return getPlayerPerformance({
				profileId: id,
				scope,
				userId
			});
		},
		{ initialValue: emptyPlayerPerformance() }
	);

	$effect(() => {
		if (user?.steamid) {
			preloadPlayerLabels([user.steamid]);
		}
	});

	const labels = $derived(labelsForSteamId(user?.steamid));

	const pagePlayer = $derived.by(() => {
		if (!profile || !user) {
			return null;
		}

		return toPlayerPageData({
			profile,
			user,
			game,
			elo: playerElo,
			performance: playerPerformance.current ?? emptyPlayerPerformance(),
			matchHistory: extra?.matchHistory ?? [],
			smurf: extra?.smurf,
			labels,
			likeCount: extra?.likeCount ?? 0,
			customization: customization.current ?? null
		});
	});

	const matchHistory = new MatchHistoryView(() => pagePlayer);

	export const snapshot: Snapshot<string> = {
		capture: () => currentTab,
		restore: (tab) => (currentTab = tab)
	};
</script>

<SetCrumbs items={[{ label: profile?.alias ?? t('Player') }]} />

{#if relicProfile.loading || steamProfile.loading || !profile || !user || !pagePlayer}
	<Player.ProfileSkeleton />
{:else}
	<PlayerProfile
		player={matchHistory.player ?? pagePlayer}
		bind:tab={currentTab}
		matchHistoryLoading={!extra}
	>
		{#snippet actions()}
			<Player.LabelEditor
				steamId={user.steamid}
				profileId={profile.profile_id}
				alias={profile.alias}
				class="shrink-0"
			/>
			{#if extra?.cheater}
				<CheaterAlert />
			{/if}
		{/snippet}
		{#snippet performance()}
			<PlayerPerformance
				profileId={profile.profile_id}
				scope={isSelf ? 'user' : 'community'}
				userId={isSelf ? account.userId : undefined}
				performance={playerPerformance.current}
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
