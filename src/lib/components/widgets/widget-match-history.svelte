<script lang="ts">
	import type { LobbyExpanded } from '$core/app/database/lobbies';
	import type { UnsubscribeFunc } from 'pocketbase';
	import * as Match from '$lib/components/match';
	import { fetch } from '@tauri-apps/plugin-http';
	import { app } from '$core/app';
	import { exp } from '$core/pocketbase';
	import { resource } from 'runed';
	import { onDestroy, onMount } from 'svelte';
	import { Skeleton } from '../ui/skeleton';
	import { Alert } from '../ui/alert';
	import { H } from '../ui/h';
	import { Button } from '../ui/button';
	import { tooltip } from '$lib/attachments';
	import { cn } from '$lib/utils';
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
						matches.mutate([...current, exp(e.record) as LobbyExpanded]);
					}
				} else if (e.action === 'update') {
					matches.mutate(
						(matches.current || []).map((match) =>
							match.id === e.record.id ? (exp(e.record) as LobbyExpanded) : match
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

	console.log(app.features.auth.user);
</script>

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
				<Match.Root
					{match}
					class={cn(
						'h-11 items-center gap-4 overflow-clip rounded-md border',
						'bg-secondary-950/40 border-secondary-800/50 text-secondary-300',
						'grid grid-cols-[50px_200px_100px_200px_150px_150px_100px_1fr_auto]'
					)}
				>
					<Match.MapImage class="w-full" />
					<Match.MapName />
					<Match.Rating class="flex justify-center" />
					<Match.Title />
					<Match.Players team="allies" />
					<Match.Players team="axis" />
					<Button variant="link">View</Button>
					<Match.Time />
					<span class="px-4">
						{#if match.needsResult}
							<HourGlass class="text-primary ms-auto" {@attach tooltip('Result pending')} />
						{:else}
							<Checks class="ms-auto text-green-400" {@attach tooltip('Result saved')} />
						{/if}
					</span>
				</Match.Root>
			{/each}
		</div>
	{/if}
{/if}
