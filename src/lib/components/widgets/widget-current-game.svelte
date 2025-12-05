<script lang="ts">
	import type { LobbyPlayer } from '@fknoobs/app';
	import {
		cn,
		getFactionFlagFromRace,
		getRacePrefix,
		getRankImageByLeaderboardId,
		Race
	} from '$lib/utils';
	import { getMapImageFromName, LEADERBOARD_IDS } from '$lib/utils/game';
	import { upperCase } from 'lodash-es';
	import { H } from '../ui/h';
	import { goto } from '$app/navigation';
	import { app } from '$core/app';
	import { Alert } from '../ui/alert';

	const getLeaderboardStats = (player: LobbyPlayer) => {
		let leaderboardId: number | undefined;

		if (!app.game.lobby) {
			return undefined;
		}

		if (app.game.lobby.type === 'Basic Match') {
			if (player.race === Race.US) {
				leaderboardId = LEADERBOARD_IDS['basic_usa'];
			} else if (player.race === Race.Wehrmacht) {
				leaderboardId = LEADERBOARD_IDS['basic_wehrmacht'];
			} else if (player.race === Race.Commonwealth) {
				leaderboardId = LEADERBOARD_IDS['basic_british'];
			} else if (player.race === Race.PanzerElite) {
				leaderboardId = LEADERBOARD_IDS['basic_panzer_elite'];
			}
		} else if (app.game.lobby.type === '1 VS. 1') {
			if (player.race === Race.US) {
				leaderboardId = LEADERBOARD_IDS['1v1_us'];
			} else if (player.race === Race.Wehrmacht) {
				leaderboardId = LEADERBOARD_IDS['1v1_heer'];
			} else if (player.race === Race.Commonwealth) {
				leaderboardId = LEADERBOARD_IDS['1v1_brit'];
			} else if (player.race === Race.PanzerElite) {
				leaderboardId = LEADERBOARD_IDS['1v1_panzer'];
			}
		} else if (app.game.lobby.type === '2 VS. 2' || app.game.lobby.type === '2 VS. 2 AT') {
			if (player.race === Race.US) {
				leaderboardId = LEADERBOARD_IDS['2v2_us'];
			} else if (player.race === Race.Wehrmacht) {
				leaderboardId = LEADERBOARD_IDS['2v2_heer'];
			} else if (player.race === Race.Commonwealth) {
				leaderboardId = LEADERBOARD_IDS['2v2_brit'];
			} else if (player.race === Race.PanzerElite) {
				leaderboardId = LEADERBOARD_IDS['2v2_panzer'];
			}
		} else if (app.game.lobby.type === '3 VS. 3' || app.game.lobby.type === '3 VS. 3 AT') {
			if (player.race === Race.US) {
				leaderboardId = LEADERBOARD_IDS['3v3_us'];
			} else if (player.race === Race.Wehrmacht) {
				leaderboardId = LEADERBOARD_IDS['3v3_heer'];
			} else if (player.race === Race.Commonwealth) {
				leaderboardId = LEADERBOARD_IDS['3v3_brit'];
			} else if (player.race === Race.PanzerElite) {
				leaderboardId = LEADERBOARD_IDS['3v3_panzer'];
			}
		} else if (app.game.lobby.type === '4 VS. 4' || app.game.lobby.type === '4 VS. 4 AT') {
			if (player.race === Race.US) {
				leaderboardId = LEADERBOARD_IDS['4v4_us'];
			} else if (player.race === Race.Wehrmacht) {
				leaderboardId = LEADERBOARD_IDS['4v4_heer'];
			} else if (player.race === Race.Commonwealth) {
				leaderboardId = LEADERBOARD_IDS['4v4_brit'];
			} else if (player.race === Race.PanzerElite) {
				leaderboardId = LEADERBOARD_IDS['4v4_panzer'];
			}
		} else if (app.game.lobby.type === 'Skirmish') {
			if (player.race === Race.US) {
				leaderboardId = LEADERBOARD_IDS['skirmish_usa'];
			} else if (player.race === Race.Wehrmacht) {
				leaderboardId = LEADERBOARD_IDS['skirmish_wehrmacht'];
			} else if (player.race === Race.Commonwealth) {
				leaderboardId = LEADERBOARD_IDS['skirmish_british'];
			} else if (player.race === Race.PanzerElite) {
				leaderboardId = LEADERBOARD_IDS['skirmish_panzer_elite'];
			}
		} else if (app.game.lobby.type === 'Operation: Assault') {
			if (player.race === Race.US) {
				leaderboardId = LEADERBOARD_IDS['operation_assault_usa'];
			} else if (player.race === Race.Wehrmacht) {
				leaderboardId = LEADERBOARD_IDS['operation_assault_wehrmacht'];
			}
		} else if (app.game.lobby.type === 'Operation: Panzerkrieg') {
			if (player.race === Race.US) {
				leaderboardId = LEADERBOARD_IDS['operation_panzerkrieg_usa'];
			} else if (player.race === Race.Wehrmacht) {
				leaderboardId = LEADERBOARD_IDS['operation_panzerkrieg_wehrmacht'];
			}
		} else if (app.game.lobby.type === 'Operation: Stonewall') {
			if (player.race === Race.US) {
				leaderboardId = LEADERBOARD_IDS['operation_stonewall_usa'];
			} else if (player.race === Race.Wehrmacht) {
				leaderboardId = LEADERBOARD_IDS['operation_stonewall_wehrmacht'];
			}
		}

		return player.profile?.leaderboardStats?.find((stat) => stat.leaderboard_id === leaderboardId);
	};
</script>

<H level="2" class="mb-4">Current game</H>
{#if !app.game.lobby}
	<Alert variant="warning">
		You are currently not in a game lobby. When you join a lobby, the details will be displayed
		here.
	</Alert>
{:else}
	<div class="grid grid-cols-[200px_auto] gap-6">
		<div>
			{#await getMapImageFromName(app.game.lobby.map!) then mapImage}
				<img
					src={mapImage}
					alt={app.game.lobby.mapName}
					class="h-auto w-full rounded-lg border-3 border-blue-300 bg-gray-900"
				/>
			{/await}
		</div>
		<div class="py-2">
			<H level="3" class="mb-4">{app.game.lobby.mapName}</H>
			<div class="grid grid-cols-2 gap-4">
				{#each app.game.lobby.teams as team}
					<div>
						<span
							class="block rounded-md border border-gray-600 bg-gray-700 px-4 py-2 font-bold text-gray-100"
						>
							Team {team.teamId + 1}
						</span>
						{#each team.players as player}
							{@const stats = getLeaderboardStats(player)}
							<button
								class={cn(
									'grid w-full grid-cols-[2rem_4rem_auto_3rem_3rem_3rem] items-center gap-2',
									'cursor-pointer rounded-md px-4 py-2 transition-colors',
									'not-last:border-b not-last:border-gray-700',
									'odd:bg-gray-900/30',
									'hover:text-primary hover:bg-gray-700/50',
									player.playerId === app.game.lobby.me?.playerId &&
										'border-primary-200/50! text-primary border!'
								)}
								onclick={() => goto(`/leaderboards/profile/${player.playerId}`)}
							>
								{#await getFactionFlagFromRace(player.race) then raceImg}
									<img src={raceImg} alt={getRacePrefix(player.race)} class="w-6 ring ring-black" />
								{/await}
								<span class="flex items-center gap-2 text-blue-200">
									{#if stats}
										{#await getRankImageByLeaderboardId(stats.leaderboard_id, stats.ranklevel) then rankImg}
											<img src={rankImg} alt="Rank" class="w-6" />
										{/await}
									{/if}
									{player.ranking}
								</span>
								<span class="flex items-center gap-2 truncate">
									{#if player.profile}
										<img
											class="w-6"
											src="https://flagsapi.com/{upperCase(player.profile.country)}/shiny/64.png"
											alt={player.profile.country}
										/>
										<span class="truncate">{player.profile.alias}</span>
									{/if}
								</span>
								{#if stats}
									<span>{stats.wins}</span>
									<span>{stats.losses}</span>
									<span
										class={cn(
											'justify-center',
											stats.streak < 0 ? 'text-red-300' : 'text-green-300'
										)}
									>
										{stats.streak}
									</span>
								{/if}
							</button>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
