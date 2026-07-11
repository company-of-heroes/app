<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs';
	import dayjs from '$lib/dayjs';
	import { Leaderboard } from '$lib/components/leaderboard';
	import { page } from '$app/state';
	import { steam } from '$core/steam';
	import { H } from '$lib/components/ui/h';
	import { relic } from '$lib/relic';
	import { cn, isSteamId } from '$lib/utils';
	import { resource } from 'runed';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { ButtonBack } from '$lib/components/ui/button';
	import { MatchHistory } from '$lib/components/match-history';
	import SmurfAlert from '$lib/components/player/smurf-alert.svelte';
	import { loadSmurfAlert } from '$lib/player/smurf';
	import type { Snapshot } from '@sveltejs/kit';

	let currentTab = $state('stats');

	const profile = resource(
		() => page.params.id,
		async (id) => {
			const relicProfile = isSteamId(id!)
				? await relic.getProfileBySteamId(id!)
				: await relic.getProfileById(parseInt(id!, 10));

			if (!relicProfile) {
				throw new Error('Profile not found');
			}

			const steamId = relicProfile.name.replace('/steam/', '');
			const [steamProfile, gamePlayTime, matchHistory] = await Promise.all([
				steam.getUserProfile(steamId),
				steam.getRecentlyPlayedGameByAppId(steamId, 228200),
				relic.getRecentMatchHistoryForProfile(relicProfile.profile_id)
			]);

			if (!steamProfile) {
				throw new Error('Profile not found');
			}

			const smurf = await loadSmurfAlert(steamId, relicProfile.profile_id);

			return {
				relic: relicProfile,
				steam: steamProfile,
				game: gamePlayTime,
				matchHistory,
				smurf
			};
		}
	);

	export const snapshot: Snapshot<string> = {
		capture: () => currentTab,
		restore: (tab) => (currentTab = tab)
	};
</script>

<ButtonBack />

{#if profile.loading}
	<div class="border-b-3 border-gray-700 pb-8">
		<div class="grid grid-cols-[220px_auto] gap-12">
			<div>
				<Skeleton class="size-50" />
			</div>
			<div class="py-4">
				<Skeleton class="mb-6 h-12 w-1/3" />
				<div>
					<Skeleton class="mb-2 h-4 w-3/12" />
					<Skeleton class="mb-2 h-4 w-2/12" />
					<Skeleton class="mb-2 h-4 w-4/12" />
				</div>
			</div>
		</div>
	</div>
{:else if profile.current}
	<div class="space-y-12">
		<div class="border-b-3 border-gray-700 pb-8">
			<div class="grid grid-cols-[220px_auto] gap-12">
				<img
					src={profile.current.steam.avatarfull}
					alt="Steam Avatar"
					class={cn(
						'w-full rounded-xl border-3 border-gray-400',
						profile.current.steam.personastate > 0 && 'border-blue-400',
						profile.current.steam.gameextrainfo?.trim() === 'Company of Heroes' &&
							'border-green-500'
					)}
				/>
				<div class="py-4">
					<H level="1">{profile.current.relic.alias}</H>
					<SmurfAlert smurf={profile.current.smurf} />
					<div class="flex flex-col gap-0.5">
						{#if profile.current.steam.timecreated}
							<span class="text-secondary-300 grid grid-cols-[150px_auto]">
								Account created:
								<span>{dayjs.unix(profile.current.steam.timecreated).format('MMMM D, YYYY')}</span>
							</span>
						{/if}
						{#if profile.current.steam.steamid}
							<span class="text-secondary-300 grid grid-cols-[150px_auto]">
								Steam ID:
								<span>{profile.current.steam.steamid}</span>
							</span>
						{/if}
						{#if profile.current.steam.lastlogoff}
							<span class="text-secondary-300 grid grid-cols-[150px_auto]">
								Last seen:
								<span>{dayjs.unix(profile.current.steam.lastlogoff).fromNow()}</span>
							</span>
						{/if}
						{#if profile.current.game?.playtime_forever}
							<span class="text-secondary-300 grid grid-cols-[150px_auto]">
								Total playtime:
								<span>{(profile.current.game.playtime_forever / 60).toFixed(0)} hours</span>
							</span>
						{/if}
						{#if profile.current.game?.playtime_2weeks}
							<span class="text-secondary-300 grid grid-cols-[150px_auto]">
								Past 2 weeks:
								<span>{(profile.current.game.playtime_2weeks / 60).toFixed(0)} hours</span>
							</span>
						{/if}
					</div>
				</div>
			</div>
		</div>
		<div>
			<Tabs.Root value={currentTab} onValueChange={(val) => (currentTab = val)}>
				<Tabs.List>
					<Tabs.Trigger value="stats">Stats</Tabs.Trigger>
					<Tabs.Trigger value="match-history">Match history</Tabs.Trigger>
				</Tabs.List>
				<Tabs.Content value="stats">
					<Leaderboard stats={profile.current.relic.leaderboardStats!} />
				</Tabs.Content>
				<Tabs.Content value="match-history">
					<MatchHistory matches={profile.current.matchHistory} />
				</Tabs.Content>
			</Tabs.Root>
		</div>
	</div>
{/if}
