<script lang="ts">
	import { app } from '$core/app';
	import { replays } from '$core/app/replays.svelte';
	import { cn, getMapImageFromName, secondsToTimestamp } from '$lib/utils';
	import { format } from 'date-fns';

	app.route = {
		title: replays.current?.replayName || replays.current?.fileName || 'Not Found',
		href: `/replays/${replays.current?.fileName}`
	};

	console.log(replays.current?.actions.map((action) => action.playerID));
</script>

{#if !replays.current}
	<div class="text-secondary-400">
		<p class="text-2xl font-medium">Failed to load replay.</p>
		<p>Go <a href="/replays">back</a> and select another replay.</p>
	</div>
{:else}
	<div class="flex flex-1 gap-12">
		<div class="border-secondary-700 w-64 border-1 border-dashed p-1">
			{#await getMapImageFromName(replays.current.mapName) then mapImage}
				<img src={mapImage} alt={replays.current.mapName} class="bg-secondary-900 w-full" />
			{/await}
		</div>
		<div class="flex-grow">
			<span class="text-2xl font-bold">{replays.current.mapNameFormatted}</span>
			<table class="[&_tr]:text-secondary-400 mt-4 table-auto [&_td]:py-[1px] [&_td]:pe-16">
				<tbody>
					<tr>
						<td>Date</td>
						<td>{format(replays.current.gameDate, 'dd/MM/yyyy')}</td>
					</tr>
					<tr>
						<td>Duration</td>
						<td>{secondsToTimestamp(replays.current.duration)}</td>
					</tr>
					<tr>
						<td>Lobby</td>
						<td>{replays.current.matchType === 'automatch' ? 'Ranked' : 'Custom Game'}</td>
					</tr>
					<tr>
						<td>Players</td>
						<td>{replays.current.playerCount}</td>
					</tr>
					<tr>
						<td>Mode</td>
						<td>{replays.current.VPgame ? "Victory point's" : 'Annihilate'}</td>
					</tr>
					{#if replays.current.VPgame}
						<tr>
							<td>VP's</td>
							<td>{replays.current.vpCount}</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</div>
	<div class="mt-12">
		<span class="mb-4 block text-2xl font-bold">Chat history</span>
		<div class="bg-secondary-900 flex flex-col items-start gap-[12px] p-4">
			{#each replays.current.messages as message (message)}
				<div
					class={cn(
						'text-primary/50 flex h-8 items-center gap-4 rounded-full px-4 text-sm',
						(() => {
							const playersPerTeam = replays.current.playerCount / 2;
							const isTeam1 = message.playerID >= 1000 && message.playerID < 1000 + playersPerTeam;
							const isTeam2 =
								message.playerID >= 1000 + playersPerTeam &&
								message.playerID < 1000 + replays.current.playerCount;

							if (isTeam1) return 'bg-blue-500/5 text-base text-blue-100';
							if (isTeam2) return 'bg-red-500/5 text-base text-red-100';
							return '';
						})()
					)}
				>
					<span class="w-14">{message.timeStamp}</span>
					<span>{message.playerName}</span>
					<span>{message.text}</span>
				</div>
			{/each}
		</div>
	</div>
{/if}
