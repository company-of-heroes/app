<script lang="ts">
	import * as Profile from '$lib/components/ui/profile';
	import * as List from '$lib/components/ui/list';
	import { app } from '$core/app';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Leaderboard } from '../leaderboard';
	import { MatchHistory } from '../match-history';
	import { relic } from '$lib/relic';

	let isLoadingRecentGames = $state(false);
	console.log(app.game.profile);
</script>

{#if app.game.profile}
	<Profile.Root
		class="border-secondary-800 grid grid-cols-[200px_auto] gap-6 border-b-2 pb-8"
		profile={app.game.profile}
	>
		<Profile.Avatar />
		<div class="py-2">
			<div class="grid grid-cols-[auto_1fr_150px_190px] items-center gap-4 truncate">
				<Profile.Flag class="relative -ms-0.5" />
				<Profile.Alias class="truncate text-3xl font-bold" />
				<Button
					variant="primary"
					class="w-full justify-center"
					onclick={() => {
						app.modal.create({
							title: 'Profile Stats',
							component: Leaderboard,
							size: 'full',
							props: { stats: app.game.profile?.relic.leaderboardStats! }
						});
						app.modal.open();
					}}
				>
					View stats
				</Button>
				<Button
					variant="primary"
					class="w-full justify-center"
					onclick={async () => {
						isLoadingRecentGames = true;
						app.modal.create({
							title: 'Profile Stats',
							component: MatchHistory,
							size: 'full',
							props: {
								matches: await relic.getRecentMatchHistoryForProfile(
									app.game.profile!.relic.profile_id
								)
							}
						});
						app.modal.open();
						isLoadingRecentGames = false;
					}}
					loading={isLoadingRecentGames}
				>
					Recent games
				</Button>
				<!-- <MatchHistory matches={profile.current.matchHistory} /> -->
			</div>
			<List.Root class="mt-2">
				<List.Title>Steam ID:</List.Title>
				<List.Value>
					<Profile.Steamid />
				</List.Value>
				<List.Title>Created:</List.Title>
				<List.Value>
					<Profile.Created />
				</List.Value>
				<List.Title>Status:</List.Title>
				<List.Value>
					<Badge variant={app.game.isIngame ? 'success' : 'warning'}>
						{app.game.isIngame ? 'In Game' : 'Looking for a game'}
					</Badge>
				</List.Value>
			</List.Root>
		</div>
	</Profile.Root>
{/if}
