<script lang="ts">
	import * as Profile from '$lib/components/ui/profile';
	import * as List from '$lib/components/ui/list';
	import { app } from '$core/app/context';
	import { Alert } from '$lib/components/ui/alert';
	import { Leaderboard } from '../leaderboard';
	import { MatchHistory } from '../match-history';
	import { relic } from '$lib/relic';
	import { cn } from '$lib/utils';
	import { interactive, statLosses, statWins } from '$lib/components/ui/variants';
	import { resource } from 'runed';
	import { upperCase } from 'lodash-es';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { countTodayRecord } from './dashboard-utils';

	let activeTab = $state('stats');
	let panelExpanded = $state(false);

	const todayMatches = resource(
		() => app.features.auth.userId,
		() =>
			app.database.matches.getList({
				filter: `createdAt > @todayStart && user = "${app.features.auth.userId}"`,
				sort: '-createdAt'
			})
	);

	const replays = resource(
		() => app.features.auth.userId,
		() =>
			app.database.replays.getPaginated(1, 1, {
				filter: `createdBy = "${app.features.auth.userId}"`
			})
	);

	const recentMatches = resource(
		() => app.game.profile?.relic.profile_id,
		(profileId) => relic.getRecentMatchHistoryForProfile(profileId!),
		{ initialValue: [] }
	);

	const todayRecord = $derived(
		countTodayRecord(todayMatches.current ?? [], app.game.profile?.relic.profile_id)
	);

	function openTab(tab: string) {
		activeTab = tab;
		panelExpanded = true;
	}

	function tabClass(tab: string) {
		return cn(
			interactive,
			'rounded-md px-4 py-1.5 font-bold transition-colors',
			activeTab === tab
				? 'bg-primary text-secondary-950'
				: 'text-white hover:bg-secondary-950/50'
		);
	}
</script>

{#if app.game.isRunning && app.game.profile}
	{@const profile = app.game.profile}
	<Profile.Root {profile}>
		<div
			class={cn(
				'bg-secondary-950/40 border-secondary-900 overflow-clip rounded-lg border',
				'hover:border-secondary-700 transition-colors'
			)}
		>
			<div class="border-secondary-800 flex gap-5 border-b p-5">
				<img
					src={profile.steam.avatarfull}
					alt={profile.relic.alias}
					class={cn(
						'size-28 shrink-0 rounded-xl border-3 object-cover',
						app.lobby ? 'border-green-500' : 'border-gray-400'
					)}
				/>

				<div class="min-w-0 grow py-1">
					<div class="mb-3 flex flex-wrap items-center gap-2.5">
						<a
							href="/players/{profile.relic.profile_id}"
							class={cn(interactive, 'hover:text-primary flex min-w-0 items-center gap-2.5 transition-colors')}
						>
							{#if profile.relic.country}
								<img
									class="h-5 w-auto shrink-0 rounded-[2px]"
									src="https://flagsapi.com/{upperCase(profile.relic.country)}/shiny/64.png"
									alt={profile.relic.country}
								/>
							{/if}
							<span class="font-heading truncate text-3xl font-bold">{profile.relic.alias}</span>
						</a>
						{#if app.lobby}
							<a
								href="/current-game"
								class={cn(interactive, 'text-success text-xs font-medium hover:underline')}
							>
								In match
							</a>
						{/if}
					</div>

					<List.Root>
						<List.Title>Steam ID:</List.Title>
						<List.Value><Profile.Steamid /></List.Value>
						<List.Title>Created:</List.Title>
						<List.Value><Profile.Created /></List.Value>
					</List.Root>
				</div>
			</div>

			<div class="border-secondary-800 border-b">
				<div class="flex items-center justify-between px-5 py-2.5">
					<div class="flex items-center gap-2">
						<button type="button" class={tabClass('stats')} onclick={() => openTab('stats')}>
							Stats
						</button>
						<button
							type="button"
							class={tabClass('recent-games')}
							onclick={() => openTab('recent-games')}
						>
							Recent games
						</button>
					</div>
					<button
						type="button"
						class={cn(
							interactive,
							'text-secondary-400 hover:text-primary p-1 transition-colors'
						)}
						aria-expanded={panelExpanded}
						aria-label={panelExpanded ? 'Collapse panel' : 'Expand panel'}
						onclick={() => (panelExpanded = !panelExpanded)}
					>
						<CaretDown
							class={cn('size-4 transition-transform', panelExpanded && 'rotate-180')}
						/>
					</button>
				</div>

				{#if panelExpanded}
					<div class="border-secondary-800 border-t">
						{#if activeTab === 'stats'}
							<Leaderboard
								stats={profile.relic.leaderboardStats ?? []}
								class="rounded-none border-0"
							/>
						{:else if recentMatches.loading}
							<div class="p-4">
								<Skeleton class="h-32 w-full" />
							</div>
						{:else}
							<div class="p-4">
								<MatchHistory matches={recentMatches.current ?? []} />
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="text-secondary-400 flex flex-wrap gap-x-5 gap-y-1 px-5 py-3 text-sm">
				<span>
					<span class="text-secondary-500">Today</span>
					{todayRecord.total} matches
				</span>
				{#if todayRecord.wins + todayRecord.losses > 0}
					<span>
						<span class={statWins}>{todayRecord.wins}W</span>
						<span class="text-secondary-600"> · </span>
						<span class={statLosses}>{todayRecord.losses}L</span>
					</span>
				{:else if todayRecord.pending > 0}
					<span>{todayRecord.pending} pending</span>
				{/if}
				{#if replays.current}
					<a href="/replays" class="hover:text-primary transition-colors">
						{replays.current.totalItems} replays
					</a>
				{/if}
				{#if app.notifications.unreadCount > 0}
					<span class="text-warning">{app.notifications.unreadCount} unread</span>
				{/if}
			</div>
		</div>
	</Profile.Root>
{:else}
	<Alert variant="warning">
		Company of Heroes is not running. Start the game to see your profile and match tracking.
	</Alert>
{/if}
