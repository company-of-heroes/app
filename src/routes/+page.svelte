<script lang="ts">
	import { H } from '$lib/components/ui/h';
	import { app } from '$lib/state/app.svelte';
	import { cn, getFactionFlagFromRace, getMapImageFromName, getSteamIdFromName } from '$lib/utils';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import CoHIconFile from '$lib/files/coh-ico.png';
	import PredictionWidget from '$lib/components/predictions/prediction-widget.svelte';
	import { LobbyHistoryWidget } from '$lib/components/lobby';

	// $effect(() => {
	// 	console.log(app.game.lobby);
	// });
</script>

<div class="flex items-start gap-[2px]">
	<div class="bg-primary-50/10 flex items-center gap-2 px-4 py-2">
		<span>Status:</span>
		<span class={cn('font-bold', app.game.isRunning ? 'text-green-600' : 'text-red-600')}>
			{app.game.isRunning ? 'online' : 'offline'}
		</span>
	</div>
	<div class="bg-primary-50/10 flex items-center gap-2 px-4 py-2">
		<span>Game:</span>
		<span class={cn('font-bold', app.game.lobby ? 'text-green-600' : 'text-primary')}>
			{app.game.lobby ? 'ingame' : 'looking for a game'}
		</span>
	</div>
</div>
{#if app.game.lobby}
	<span class="my-4 mt-6 flex items-center gap-4 text-lg font-bold">
		<span class="text-primary-100">{app.game.lobby.mapName}</span>
		<span class="text-secondary-300">({app.game.lobby.type})</span>
	</span>
	<div class="flex gap-4">
		<div>
			<div class="bg-secondary-900 w-44">
				{#await getMapImageFromName(app.game.lobby.map!) then image}
					<img src={image} alt="Map" class="mr-4 w-full" />
				{/await}
			</div>
		</div>
		<div>
			<div class="flex gap-[1px]">
				{#each app.game.lobby.teams as team}
					<div class="w-74">
						<span class="text-secondary-400 bg-secondary-800 mb-0.5 block px-4 py-2 font-bold">
							Team {team.teamId + 1}
						</span>
						<div class="flex flex-col gap-[1px]">
							{#each team.players as player}
								<span class={cn('bg-primary-50/5 flex items-center gap-2 px-4 py-2')}>
									<small>
										{player.ranking}
									</small>
									{#if app.game.lobby.isRanked}
										{#await app.game.lobby.getRankImage(player) then rankImage}
											<img src={rankImage} alt="Rank" class="w-6" />
										{/await}
									{/if}
									<span>
										<img
											src={getFactionFlagFromRace(player.race)}
											alt={player.race.toString()}
											class="w-6"
										/>
									</span>
									<span class="w-44 truncate">{player.profile?.alias}</span>
									<span class="ml-auto flex items-center gap-2">
										<button
											onclick={() =>
												openUrl(
													`https://steamcommunity.com/profiles/${getSteamIdFromName(player.profile!.name)}`
												)}
											class="text-secondary-400 hover:text-secondary-200 cursor-pointer"
										>
											<svg
												role="img"
												viewBox="0 0 24 24"
												class="w-4 fill-current"
												xmlns="http://www.w3.org/2000/svg"
											>
												<title>Steam</title>
												<path
													d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"
												/>
											</svg>
										</button>
										<button
											onclick={() =>
												openUrl(
													`https://playercard.cohstats.com/?steamid=${getSteamIdFromName(player.profile!.name)}`
												)}
											class="w-4 cursor-pointer hover:opacity-85"
										>
											<img src={CoHIconFile} alt="CoH" class="w-full" title="cohstats.com" />
										</button>
									</span>
								</span>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<div class="mt-12 flex flex-col gap-4">
	<LobbyHistoryWidget />
	<PredictionWidget />
</div>
