<script lang="ts">
	import dayjs from '$lib/dayjs';
	import { Leaderboard } from '$lib/components/leaderboard';
	import { page } from '$app/state';
	import { steam } from '$core/steam';
	import { relic } from '$lib/relic';
	import { isSteamId } from '$lib/utils';
	import { resource } from 'runed';
	import * as Player from '$lib/components/player';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { PlayerPerformance } from '$lib/components/player-performance';
	import PlayerCompanionStaffDebug from '$lib/components/player/player-companion-staff-debug.svelte';
	import CheaterAlert from '$lib/components/player/cheater-alert.svelte';
	import PlayerScreenshots from '$lib/components/player/player-screenshots.svelte';
	import { loadSmurfAlert } from '$lib/player/smurf';
	import { toPlayerPageData } from '$lib/player/page-data';
	import { findCheaterBySteamId } from '$core/pocketbase/anti-cheat';
	import { account } from '$core/account';
	import { app } from '$core/app/context';
	import { getPlayerRating } from '$core/pocketbase/player-ratings';
	import {
		emptyPlayerPerformance,
		getPlayerPerformance
	} from '$core/pocketbase/player-performance';
	import { eloMapForSteamId, mergeEloMaps } from '$lib/utils/player-elo';
	import { tabTrigger } from '$lib/components/ui/variants';
	import { labelsForSteamId, preloadPlayerLabels } from '$core/pocketbase/player-label-cache.svelte';
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
			const [matchHistory, playerRating, cheater, smurf, likeCount] = await Promise.all([
				relic.getRecentMatchHistoryForProfile(profile.profile_id, {
					includeHidden: true
				}),
				getPlayerRating(id),
				findCheaterBySteamId(id),
				loadSmurfAlert(id, profile.profile_id),
				app.database.playerSocial.getLikeCount(id)
			]);
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

	const performance = resource(
		[() => profile?.profile_id ?? null, () => (isSelf ? 'user' : 'community'), () => (isSelf ? account.userId : null)],
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
			performance: performance.current ?? emptyPlayerPerformance(),
			matchHistory: extra?.matchHistory ?? [],
			smurf: extra?.smurf,
			labels,
			likeCount: extra?.likeCount ?? 0
		});
	});

	const emptyTrackedLabel = $derived(
		isSelf
			? t('Play with the companion running to build stats.')
			: t('No tracked community matches for this player.')
	);

	export const snapshot: Snapshot<string> = {
		capture: () => currentTab,
		restore: (tab) => (currentTab = tab)
	};
</script>

<SetCrumbs items={[{ label: profile?.alias ?? t('Player') }]} />

{#if relicProfile.loading || steamProfile.loading || !profile || !user || !pagePlayer}
	<Player.ProfileSkeleton />
{:else}
	<div class="border-secondary-900 overflow-clip border-b">
		<Player.ProfileHeader player={pagePlayer} {emptyTrackedLabel}>
			{#snippet vote()}
				<Player.LikeButton steamId={user.steamid} likeCount={pagePlayer.likeCount ?? 0} />
			{/snippet}
			{#snippet afterName()}
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
			{#snippet afterDetails()}
				<PlayerCompanionStaffDebug steamId={user.steamid} />
			{/snippet}
		</Player.ProfileHeader>

		<div class="border-secondary-800 border-b">
			<div class="flex items-center gap-2 px-4 py-2.5">
				<button
					type="button"
					class={tabTrigger}
					data-state={currentTab === 'stats' ? 'active' : undefined}
					onclick={() => (currentTab = 'stats')}
				>
					{t('Stats')}
				</button>
				<button
					type="button"
					class={tabTrigger}
					data-state={currentTab === 'performance' ? 'active' : undefined}
					onclick={() => (currentTab = 'performance')}
				>
					{t('Performance')}
				</button>
				<button
					type="button"
					class={tabTrigger}
					data-state={currentTab === 'match-history' ? 'active' : undefined}
					onclick={() => (currentTab = 'match-history')}
				>
					{t('Match history')}
				</button>
				<button
					type="button"
					class={tabTrigger}
					data-state={currentTab === 'screenshots' ? 'active' : undefined}
					onclick={() => (currentTab = 'screenshots')}
				>
					{t('Screenshots')}
				</button>
			</div>

			<div class="border-secondary-800 border-t">
				{#if currentTab === 'stats'}
					<Player.StatsTable player={pagePlayer} />
				{:else if currentTab === 'performance'}
					<PlayerPerformance
						profileId={profile.profile_id}
						scope={isSelf ? 'user' : 'community'}
						userId={isSelf ? account.userId : undefined}
						empty={isSelf ? 'self' : 'other'}
						class="rounded-none border-0"
					/>
				{:else if currentTab === 'match-history'}
					{#if !extra}
						<Leaderboard stats={[]} loading skeletonRows={10} class="rounded-none border-0" />
					{:else}
						<Player.MatchHistory player={pagePlayer} />
					{/if}
				{:else}
					<PlayerScreenshots
						steamId={user.steamid}
						userId={isSelf ? account.userId : undefined}
						profileId={profile.profile_id}
					/>
				{/if}
			</div>
		</div>

		<div
			class="text-secondary-400 bg-secondary-950/50 flex flex-wrap gap-x-4 gap-y-1 px-4 py-3 text-sm"
		>
			{#if user.lastlogoff}
				<span>
					<span class="text-secondary-500">{t('Last seen')}</span>
					{dayjs.unix(user.lastlogoff).fromNow()}
				</span>
			{/if}
			{#if game?.playtime_forever}
				<span>
					<span class="text-secondary-500">{t('Playtime')}</span>
					{t('{hours} hours', { hours: (game.playtime_forever / 60).toFixed(0) })}
				</span>
			{/if}
			{#if game?.playtime_2weeks}
				<span>
					<span class="text-secondary-500">{t('Past 2 weeks')}</span>
					{t('{hours} hours', { hours: (game.playtime_2weeks / 60).toFixed(0) })}
				</span>
			{/if}
		</div>
	</div>
{/if}
