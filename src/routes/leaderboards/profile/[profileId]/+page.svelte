<script lang="ts">
	import { Leaderboard } from '$lib/components/leaderboard';
	import { page } from '$app/state';
	import { steam } from '$core/steam';
	import { H } from '$lib/components/ui/h';
	import { ToggleGroup } from '$lib/components/ui/toggle-group';
	import dayjs from '$lib/dayjs';
	import { relic } from '$lib/relic';
	import { cn } from '$lib/utils';
	import { resource } from 'runed';
	import { onMount } from 'svelte';

	const profile = resource(
		() => page.params.profileId,
		async (id) => {
			const relicProfile = await relic.getProfileById(parseInt(id!));

			console.log(relicProfile);

			if (!relicProfile) {
				throw new Error('Profile not found');
			}

			const steamId = relicProfile.name.replace('/steam/', '');
			const [steamProfile, gamePlayTime] = await Promise.all([
				steam.getUserProfile(steamId),
				steam.getRecentlyPlayedGameByAppId(steamId, 228200)
			]);

			if (!steamProfile) {
				throw new Error('Profile not found');
			}

			console.log(relicProfile);

			return {
				relic: relicProfile,
				steam: steamProfile,
				game: gamePlayTime
			};
		}
	);
</script>

{#if profile.current}
	<div class="space-y-12">
		<div class="bg-secondary-950 border-secondary-700 rounded-lg border p-6">
			<div class="grid grid-cols-[220px_auto] gap-12">
				<img
					src={profile.current.steam.avatarfull}
					alt="Steam Avatar"
					class={cn(
						'w-full rounded-xl border-3 border-gray-400 shadow-lg',
						profile.current.steam.personastate > 0 && 'border-blue-400',
						profile.current.steam.gameextrainfo?.trim() === 'Company of Heroes' &&
							'border-green-500'
					)}
				/>
				<div class="py-4">
					<H level="1">{profile.current.relic.alias}</H>
					<div class="flex flex-col gap-0.5">
						{#if profile.current.steam.timecreated}
							<span class="text-secondary-300 grid grid-cols-[150px_auto]">
								Account created:
								<span>{dayjs.unix(profile.current.steam.timecreated).format('MMMM D, YYYY')}</span>
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
			<H level="2" class="mb-6">Stats</H>
			<Leaderboard stats={profile.current.relic.leaderboardStats!} />
		</div>
	</div>
{/if}
