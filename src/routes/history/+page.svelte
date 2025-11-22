<script lang="ts">
	import { app } from '$core/app';
	import { H } from '$lib/components/ui/h';
	import { getMapImageFromName } from '$lib/utils/game';
	import { resource } from 'runed';

	let filters = $state({
		search: '',
		dateFrom: null,
		dateTo: null
	});

	const lobbies = resource(
		() => filters,
		async (filters) => {
			const result = await app.database.lobbies.getAll();

			if (result.isErr()) {
				console.error('Failed to fetch lobbies:', result.error);
				return [];
			}

			return result.value;
		}
	);

	$inspect(lobbies.current);
</script>

<H level="1">History</H>
{#if lobbies.current}
	<div class="grid gap-4">
		{#each lobbies.current as lobby}
			<div class="grid grid-cols-[220px_auto] rounded-lg border border-gray-700 bg-gray-800 p-4">
				{#await getMapImageFromName(lobby.map) then mapImg}
					<img src={mapImg} alt={lobby.map} class="mb-4 h-auto w-full rounded-lg bg-gray-900" />
				{/await}
			</div>
		{/each}
	</div>
{/if}
