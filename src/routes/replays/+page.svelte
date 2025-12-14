<script lang="ts">
	import { app } from '$core/app';
	import { tooltip } from '$lib/attachments';
	import { H } from '$lib/components/ui/h';
	import { Pagination } from '$lib/components/ui/pagination';
	import { Table, TD, TH, THead, TR } from '$lib/components/ui/table';
	import dayjs from '$lib/dayjs';
	import { getFactionFlagFromRace } from '$lib/utils';
	import { getString } from '$lib/utils/game';
	import { resource } from 'runed';

	let page = $state(1);
	let searchResource = resource([() => page], async ([page]) =>
		app.database.replays().getAll(page, 50, {
			filter: `createdBy = "${app.pocketbase.authStore.record!.id}"`
		})
	);

    //$inspect(searchResource.current)

	// $effect(() => {
	// 	console.log(searchResource.current?.items);
	// });
</script>

<H level="1">Replays</H>
<div class="flex justify-end">
    <Pagination count={searchResource.current?.totalItems || 0} perPage={searchResource.current?.perPage || 50} bind:page />
</div>
<Table>
    <THead>
        <TH width="4/24">Title</TH>
        <TH width="3/24">Allies</TH>
        <TH width="3/24">Axis</TH>
        <TH width="2/24">Duration</TH>
        <TH width="2/24" class="text-center">Players</TH>
        <TH width="3/24">Map</TH>
        <TH width="3/24">Date</TH>
    </THead>
    {#if searchResource.loading}
        {#each Array(10) as _, i}
            <TR>
                <TD width="4/24">
                    <div class="h-4 w-3/4 animate-pulse bg-gray-700/50 rounded"></div>
                </TD>
                <TD width="3/24">
                    <div class="h-4 w-1/2 animate-pulse bg-gray-700/50 rounded"></div>
                </TD>
                <TD width="3/24">
                    <div class="h-4 w-1/2 animate-pulse bg-gray-700/50 rounded"></div>
                </TD>
                <TD width="2/24">
                    <div class="h-4 w-1/3 animate-pulse bg-gray-700/50 rounded"></div>
                </TD>
                <TD width="2/24" class="text-center">
                    <div class="h-4 w-1/4 animate-pulse bg-gray-700/50 rounded mx-auto"></div>
                </TD>
                <TD width="3/24">
                    <div class="h-4 w-1/2 animate-pulse bg-gray-700/50 rounded"></div>
                </TD>
                <TD width="3/24">
                    <div class="h-4 w-2/3 animate-pulse bg-gray-700/50 rounded"></div>
                </TD>
            </TR>
        {/each}
    {:else if searchResource.current}
        {#each searchResource.current.items as item}
                {@const allies = item.players?.filter((p) => p.faction.startsWith('allies')) || []}
                {@const axis = item.players?.filter((p) => p.faction.startsWith('axis')) || []}
                <TR href={`/replays/${item.id}`}>
                    <TD width="4/24">{item.title}</TD>
                    <TD width="3/24" class="flex gap-2">
                        <span class="flex items-center gap-1 truncate">
                            {#each allies as player}
                                <img
                                    src={getFactionFlagFromRace(
                                        player.faction as 'allies' | 'axis' | 'allies_commonwealth' | 'axis_panzer_elite'
                                    )}
                                    alt={player.faction}
                                    class="h-4"
                                    {@attach tooltip(player.name)}
                                />
                            {/each}
                        </span>
                    </TD>
                    <TD width="3/24" class="flex gap-2">
                        <span class="flex items-center gap-1 truncate">
                            {#each axis as player}
                                <img
                                    src={getFactionFlagFromRace(
                                        player.faction as 'allies' | 'axis' | 'allies_commonwealth' | 'axis_panzer_elite'
                                    )}
                                    alt={player.faction}
                                    class="h-4"
                                    {@attach tooltip(player.name)}
                                />
                            {/each}
                        </span>
                    </TD>
                    <TD width="2/24">
                        {dayjs
                            .duration(item.durationInSeconds, 'seconds')
                            .format(item.durationInSeconds < 3600 ? 'm[min]' : 'H[hr] m[min]')}
                    </TD>
                    <TD width="2/24" class="text-center">{item.players?.length}</TD>
                    <TD width="3/24">{getString(item.mapName)}</TD>
                    <TD width="3/24">{dayjs(item.gameDate).format('YYYY-MM-DD HH:mm')}</TD>
                </TR>
            {/each}
    {/if}
</Table>
<div class="flex justify-end">
    <Pagination count={searchResource.current?.totalItems || 0} perPage={searchResource.current?.perPage || 50} bind:page />
</div>
