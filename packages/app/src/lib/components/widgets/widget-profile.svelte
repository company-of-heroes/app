<script lang="ts">
	import * as Profile from '$lib/components/ui/profile';
	import * as List from '$lib/components/ui/list';
	import * as Player from '$lib/components/player';
	import { app } from '$core/app/context';
	import { Button } from '$lib/components/ui/button';
	import { Leaderboard } from '../leaderboard';
	import { MatchHistory } from '../match-history';
	import { relic } from '$lib/relic';
	import { getPlayerRating } from '$core/pocketbase/player-ratings';
	import { useI18n } from '$lib/i18n';

	const { t } = useI18n();

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
			<div class="flex min-w-0 items-center gap-2.5">
				<Profile.Flag class="relative -ms-0.5" />
				<Profile.Alias class="truncate text-3xl font-bold" />
				<Player.Labels steamId={app.game.profile.steam.steamid} class="shrink-0" />
			</div>
			<List.Root class="mt-2">
				<List.Title>{t('Steam ID:')}</List.Title>
				<List.Value>
					<Profile.Steamid />
				</List.Value>
				<List.Title>{t('Created:')}</List.Title>
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
						const profile = app.game.profile!;
						const [stats, rating] = await Promise.all([
							relic.getLeaderboardStatsForProfile(profile.relic.profile_id),
							getPlayerRating(profile.steam.steamid)
						]);
						app.modal.create({
							title: t('Profile Stats'),
							component: Leaderboard,
							size: 'full',
							props: {
								stats,
								elo: rating?.elo ?? {},
								wrapperClass: 'p-4'
							}
						});
						app.modal.open();
						isLoadingStats = false;
					}}
					loading={isLoadingStats}
				>
					{t('View stats')}
				</Button>
				<Button
					variant="primary"
					class="justify-center"
					onclick={async () => {
						isLoadingRecentGames = true;
						app.modal.create({
							title: t('Profile Stats'),
							component: MatchHistory,
							size: 'full',
							props: {
								matches: await relic.getRecentMatchHistoryForProfile(
									app.game.profile!.relic.profile_id
								),
								showSessionId: true,
								class: 'p-4'
							}
						});
						app.modal.open();
						isLoadingRecentGames = false;
					}}
					loading={isLoadingRecentGames}
				>
					{t('Recent games')}
				</Button>
				{#if app.lobby}
					<Button href="/current-game" variant="secondary">{t('Current Game')}</Button>
				{/if}
			</div>
		</div>
	</Profile.Root>
{/if}
