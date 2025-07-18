<script lang="ts">
	import { app } from '$core/app';
	import { replays } from '$core/app/replays.svelte';
	import { Player } from '$core/replay-analyzer';
	import { ScrollArea } from '$lib/components/scroll-area';
	import { cn, getFactionFlagFromRace, getMapImageFromName, secondsToTimestamp } from '$lib/utils';
	import { format } from 'date-fns';

	app.route = {
		title: replays.current?.replayName || replays.current?.fileName || 'Not Found',
		href: `/replays/${replays.current?.fileName}`
	};

	console.log(replays.current?.teams);
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
			<div class="mt-4 grid grid-cols-[1fr_auto] items-start">
				<table
					class="[&_tr]:text-secondary-400 max-w-[400px] table-auto [&_td]:py-[1px] [&_td]:pe-16"
				>
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
				<div class="grid grid-cols-[250px_250px] gap-[1px]">
					<div class="grid gap-[1px]">
						<span class="bg-secondary-800 h-10 px-4 leading-10 font-bold">Axis</span>
						<span class="bg-secondary-800 my-1 h-[2px]"></span>
						{#each replays.current.teams[0] as player}
							<span
								class="bg-primary/5 grid h-10 grid-cols-[28px_1fr] items-center gap-3 px-4 leading-10"
							>
								{#await getFactionFlagFromRace(player.faction) then factionFlag}
									<img src={factionFlag} alt={player.faction} />
								{/await}
								<span class="truncate">{player.name}</span>
							</span>
						{/each}
					</div>
					<div class="grid gap-[1px]">
						<span class="bg-secondary-800 h-10 px-4 leading-10 font-bold">Allies</span>
						<span class="bg-secondary-800 my-1 h-[2px]"></span>
						{#each replays.current.teams[1] as player}
							<span class="bg-primary/5 flex h-10 items-center gap-2 px-4 leading-10">
								{#await getFactionFlagFromRace(player.faction) then factionFlag}
									<img src={factionFlag} alt={player.faction} class="w-6" />
								{/await}
								<span class="truncate">{player.name}</span>
							</span>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="mt-12">
		<span class="mb-4 block text-2xl font-bold">Chat history</span>
		<ScrollArea class="border-secondary-700 border bg-gray-800 px-6 py-4" heigth="max-h-[400px]">
			<div class="flex flex-col items-start gap-1">
				{#each replays.current.messages as message (message)}
					<div
						class={cn(
							'text-primary/50 flex h-6 items-center gap-4 text-sm',
							(() => {
								const playersPerTeam = replays.current.playerCount / 2;
								const isTeam1 =
									message.playerID >= 1000 && message.playerID < 1000 + playersPerTeam;
								const isTeam2 =
									message.playerID >= 1000 + playersPerTeam &&
									message.playerID < 1000 + replays.current.playerCount;

								if (isTeam1) return 'text-base text-blue-200';
								if (isTeam2) return 'text-base text-red-200';
								return '';
							})()
						)}
					>
						<span class="w-14">{message.timeStamp}</span>
						{#if message.playerID !== 0}
							<span class={cn('w-10 text-emerald-200', message.recipient === 0 && '!text-white')}>
								{message.recipient === 1 ? '[TEAM]' : '[ALL]'}
							</span>
						{/if}
						<span>{message.playerName}</span>
						<span>{message.text}</span>
					</div>
				{/each}
			</div>
		</ScrollArea>
	</div>
{/if}
