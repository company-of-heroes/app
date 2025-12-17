<script lang="ts">
	import type { LobbiesExpanded } from '$core/app/database/lobbies';
	import type { UnsubscribeFunc } from 'pocketbase';
	import type { LobbyPlayer } from '@fknoobs/app';
	import { fetch } from '@tauri-apps/plugin-http';
	import { app } from '$core/app';
	import { exp } from '$core/pocketbase';
	import { resource } from 'runed';
	import { onDestroy, onMount } from 'svelte';
	import { Skeleton } from '../ui/skeleton';
	import { Alert } from '../ui/alert';
	import { H } from '../ui/h';
	import { Badge } from '../ui/badge';
	import { Button } from '../ui/button';
	import { getMapImageFromName, Race } from '$lib/utils/game';
	import { tooltip } from '$lib/attachments';
	import { cn, getFactionFlagFromRace, getRacePrefix, normalizeMapName } from '$lib/utils';
	import CaretUp from 'phosphor-svelte/lib/CaretUp';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import HourGlass from 'phosphor-svelte/lib/Hourglass';
	import Checks from 'phosphor-svelte/lib/Checks';

	let unsubscribe = $state<UnsubscribeFunc>();
	let matches = resource(
		() => null,
		() => app.database.lobbies.getList({ filter: 'createdAt > @todayStart' })
	);

	onMount(async () => {
		unsubscribe = await app.pocketbase.collection('lobbies').subscribe(
			'*',
			(e) => {
				if (e.action === 'create') {
					const current = matches.current || [];
					if (!current.find((m) => m.id === e.record.id)) {
						matches.mutate([exp(e.record) as LobbiesExpanded, ...current]);
					}
				} else if (e.action === 'update') {
					matches.mutate(
						(matches.current || []).map((match) =>
							match.id === e.record.id ? (exp(e.record) as LobbiesExpanded) : match
						)
					);
				} else if (e.action === 'delete') {
					matches.mutate((matches.current || []).filter((match) => match.id !== e.record.id));
				}
			},
			{ fetch }
		);
	});

	onDestroy(() => {
		unsubscribe?.();
	});
</script>

{#snippet team(players: LobbyPlayer[])}
	{#each players as player}
		<img
			src={getFactionFlagFromRace(player.race)}
			alt={getRacePrefix(player.race)}
			class={cn('border-secondary-950 size-5 rounded-full border-4 object-cover not-first:-ml-2')}
			{@attach tooltip(player.profile?.alias || 'Unknown')}
		/>
	{/each}
{/snippet}

<H level="2" class="mb-6">Matches played today</H>

{#if matches.loading}
	<div class="grid gap-[2px]">
		{#each Array(5) as _}
			<Skeleton class="bg-secondary-950/40 h-11" />
		{/each}
	</div>
{:else if matches.current}
	{#if matches.current.length === 0}
		<Alert variant="info">You have not played any matches today.</Alert>
	{:else}
		<div class="grid gap-[2px]">
			{#each matches.current as match, _ (match.id)}
				{@const result = match.result?.players.find((p) => p.steamId === app.game.steamId)}
				{@const allies =
					match.players?.filter((p) => p.race === Race.US || p.race === Race.Commonwealth) || []}
				{@const axis =
					match.players?.filter((p) => p.race === Race.Wehrmacht || p.race === Race.PanzerElite) ||
					[]}
				<div
					class={cn(
						'h-11 items-center gap-4 overflow-clip rounded-md border',
						'bg-secondary-950/40 border-secondary-800/50 text-secondary-300',
						'grid grid-cols-[50px_60px_60px_200px_100px_150px_100px_80px_1fr_auto]'
					)}
				>
					<span
						class="flex h-full w-full items-center justify-center bg-gray-950"
						{@attach tooltip(match.map)}
					>
						<img src={getMapImageFromName(match.map)} alt={match.map} class="w-full" />
					</span>
					<span class="text-center text-sm text-white">
						{#if result}
							{result.newrating}
						{:else}
							--
						{/if}
					</span>
					<span class="flex items-center gap-2">
						{#if result}
							{#if result.newrating < result.oldrating}
								<CaretDown class="inline-block text-red-400" weight="duotone" />
								{result.oldrating - result.newrating}
							{:else}
								<CaretUp class="inline-block text-green-400" weight="duotone" />
								{result.newrating - result.oldrating}
							{/if}
						{/if}
					</span>
					<span class="truncate">{normalizeMapName(match.map)}</span>
					<span>
						{#if match.isRanked}
							<Badge>Ranked</Badge>
						{/if}
					</span>
					<span class="truncate text-center">{match.title}</span>
					<span>
						<span class="flex items-center">
							{@render team(axis)}
						</span>
					</span>
					<span>
						<span class="flex items-center">
							{@render team(allies)}
						</span>
					</span>
					<span class="flex justify-end">
						<Button variant="link">View</Button>
					</span>
					<span class="px-4">
						{#if match.needsResult}
							<HourGlass class="text-primary ms-auto" {@attach tooltip('Result pending')} />
						{:else}
							<Checks class="ms-auto text-green-400" {@attach tooltip('Result saved')} />
						{/if}
					</span>
				</div>
			{/each}
		</div>
	{/if}
{/if}
