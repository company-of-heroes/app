<script lang="ts">
	import * as Profile from '$lib/components/ui/profile';
	import * as List from '$lib/components/ui/list';
	import { app } from '$core/app/context';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Leaderboard } from '../leaderboard';
	import { MatchHistory } from '../match-history';
	import { relic } from '$lib/relic';

	let isLoadingRecentGames = $state(false);
	let isLoadingStats = $state(false);
</script>

{#if app.game.profile}
	<Profile.Root
		class="border-secondary-800 grid grid-cols-[200px_auto] gap-6 border-b-2 pb-8"
		profile={app.game.profile}
	>
		<Profile.Avatar />
		<div class="py-2">
			<div class="grid grid-cols-[auto_1fr] items-center gap-4 truncate">
				<Profile.Flag class="relative -ms-0.5" />
				<Profile.Alias class="truncate text-3xl font-bold" />
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
			</List.Root>
			<div class="mt-4 flex gap-4">
				<Button
					variant="primary"
					class="justify-center"
					onclick={async () => {
						isLoadingStats = true;
						app.modal.create({
							title: 'Profile Stats',
							component: Leaderboard,
							size: 'full',
							props: {
								stats: await relic.getLeaderboardStatsForProfile(app.game.profile!.relic.profile_id)
							}
						});
						app.modal.open();
						isLoadingStats = false;
					}}
					loading={isLoadingStats}
				>
					View stats
				</Button>
				<Button
					variant="primary"
					class="justify-center"
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
			</div>
		</div>
	</Profile.Root>
{/if}
