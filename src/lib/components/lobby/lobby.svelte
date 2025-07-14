<script lang="ts">
	import type { Lobby } from '$lib/state/coh.svelte';
	import { cn, getFactionFlagFromRace, getMapImageFromName, getRankImage } from '$lib/utils';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDown';

	type LobbyProps = {
		lobby: Lobby;
	};

	let { lobby }: LobbyProps = $props();
</script>

<div
	class={cn(
		' flex items-center gap-[1px]',
		'[&>span]:bg-primary/5 [&>span]:flex [&>span]:h-10 [&>span]:items-center [&>span]:px-4'
	)}
>
	<span class="!px-0">
		{#await getMapImageFromName(lobby.map!) then mapImage}
			<img src={mapImage} alt="Map" class="h-10 w-10" />
		{/await}
	</span>
	<span>
		<img src={getFactionFlagFromRace(lobby.me!.race)} alt="Faction" class="relative w-5" />
	</span>
	<span class="w-64 truncate font-medium">
		{lobby.mapName}
	</span>
	<span class="text-secondary-400 w-34">{lobby.type}</span>
	<span
		class={cn(
			'w-24 justify-center text-sm font-bold',
			lobby.outcome === 'PS_WON' && 'text-green-600',
			lobby.outcome === 'PS_LOST' && 'text-red-600'
		)}
	>
		{lobby.outcomeFormatted}
	</span>
	<span class="me-[1px] flex-grow"></span>
</div>
