<script lang="ts">
	import { format } from 'date-fns';
	import { replays } from '$core/app/replays.svelte';
</script>

<div class="grid grid-cols-23 gap-[1px]">
	<span class="bg-secondary-800 col-start-1 col-end-7 h-10 px-4 leading-10 font-bold">Name</span>
	<span class="bg-secondary-800 col-start-7 col-end-11 h-10 px-4 leading-10 font-bold">Map</span>
	<span class="bg-secondary-800 col-start-11 col-end-15 h-10 px-4 text-center leading-10 font-bold">
		Date
	</span>
	<span class="bg-secondary-800 col-start-15 col-end-19 h-10 px-4 leading-10 font-bold">Axis</span>
	<span class="bg-secondary-800 col-start-19 col-end-24 h-10 px-4 leading-10 font-bold">
		Allies
	</span>
	<span class="bg-secondary-800 col-start-1 col-end-24 my-1 h-[2px]"></span>
</div>
<div class="grid gap-[1px]">
	{#each replays.replays as replay (replay.MD5Hash)}
		{@const axisPlayers = replay.teams[0]
			.map((player) => player.name)
			.join(
				'<span class="inline-block h-[22px] top-[5px] relative w-[2px] mx-3 bg-secondary-700"></span>'
			)}
		{@const alliedPlayers = replay.teams[1]
			.map((player) => player.name)
			.join(
				'<span class="inline-block h-[22px] top-[5px] relative w-[2px] mx-3 bg-secondary-700"></span>'
			)}

		<a
			href={`/replays/${replay.fileName}`}
			class="[&>span]:bg-primary/5 hover:[&>span]:bg-primary/7 grid grid-cols-23 gap-[1px] transition-colors duration-200"
		>
			<span class="col-start-1 col-end-7 h-10 truncate px-4 leading-10">
				{replay.replayName || replay.fileName}
			</span>
			<span class="col-start-7 col-end-11 h-10 truncate px-4 leading-10">
				{replay.mapName}
			</span>
			<span
				class="col-start-11 col-end-15 h-10 truncate px-4 text-center leading-10"
				title={format(replay.gameDate, 'dd/MM/yyyy HH:mm')}
			>
				{format(replay.gameDate, 'dd/MM/yyyy HH:mm')}
			</span>
			<span
				class="col-start-15 col-end-19 h-10 truncate px-4 leading-10"
				title={replay.teams[0].map((player) => player.name).join(', ')}
			>
				{@html axisPlayers}
			</span>
			<span
				class="col-start-19 col-end-24 h-10 truncate px-4 leading-10"
				title={replay.teams[1].map((player) => player.name).join(', ')}
			>
				{@html alliedPlayers}
			</span>
		</a>
	{/each}
</div>
