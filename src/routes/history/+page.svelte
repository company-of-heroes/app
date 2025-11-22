<script lang="ts">
	import type { LobbyFilters } from '$core/app/database/lobbies';
	import { app } from '$core/app';
	import { H } from '$lib/components/ui/h';
	import { getMapImageFromName } from '$lib/utils/game';
	import { resource } from 'runed';
	import { normalizeMapName } from '$lib/utils';

	let filters = $state<LobbyFilters>({
		createdAfter: undefined,
		createdBefore: undefined,
		map: undefined,
		matchType: undefined,
		createdDate: undefined,
		isRanked: undefined,
		outcome: undefined,
		playerName: undefined,
		searchTerm: undefined,
		sessionId: undefined
	});

	const lobbies = resource(
		() => filters,
		() => app.database.lobbies.filter(filters)
	);

	$inspect(lobbies.current);
</script>

<H level="1">History</H>
{#if lobbies.current}
	<div class="grid gap-4">
		{#each lobbies.current as lobby}
			<div
				class="grid grid-cols-[200px_auto] gap-6 rounded-lg border border-gray-700 bg-gray-800 p-4"
			>
				<img
					src={await getMapImageFromName(lobby.map)}
					alt={lobby.map}
					class="mb-4 h-auto w-full rounded-lg bg-gray-900"
				/>
				<div class="py-2">
					<div class="mb-2 text-lg font-bold">{normalizeMapName(lobby.map)}</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
