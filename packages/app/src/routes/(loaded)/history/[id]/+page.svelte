<script lang="ts">
	import * as List from '$lib/components/ui/list';
	import * as Player from '$lib/components/player';
	import { DataTable, type ColumnDef } from '$lib/components/ui/table';
	import * as Match from '$lib/components/match';
	import * as Replay from '$lib/components/replay';
	import { scale } from 'svelte/transition';
	import { onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { app } from '$core/app/context';
	import { Button, ButtonBack } from '$lib/components/ui/button';
	import { H } from '$lib/components/ui/h';
	import { cn } from '$lib/utils';
	import { getLeaderboardStatsForPlayerByMatchType } from '$lib/utils/game';
	import { resource } from 'runed';
	import { tooltip } from '$lib/attachments';
	import { sortBy } from 'lodash-es';
	import { bounceInOut } from 'svelte/easing';
	import dayjs from '$lib/dayjs';
	import HourGlass from 'phosphor-svelte/lib/Hourglass';
	import Checks from 'phosphor-svelte/lib/Checks';
	import Download from 'phosphor-svelte/lib/Download';
	import Check from 'phosphor-svelte/lib/Check';

	const match = resource(
		() => page.params.id,
		() => app.database.matches.getById(page.params.id!)
	);

	type MatchPlayer = NonNullable<typeof match.current>['players'][number];

	const playerColumns: ColumnDef<MatchPlayer>[] = [
		{ id: 'rating_change', header: '-', width: 'w-2/24', class: 'flex justify-center' },
		{ id: 'elo', header: 'ELO', width: 'w-2/24', headerClass: 'text-center', class: 'flex justify-center' },
		{ id: 'rank', header: 'Rank', width: 'w-2/24', headerClass: 'text-center', class: 'flex justify-center' },
		{ id: 'name', header: 'Name', width: 'w-9/24', class: 'flex items-center gap-4' },
		{ id: 'wins', header: 'Wins', width: 'w-3/24', headerClass: 'text-center', class: 'flex justify-center' },
		{ id: 'losses', header: 'Losses', width: 'w-3/24', headerClass: 'text-center', class: 'flex justify-center' },
		{ id: 'streak', header: 'Streak', width: 'w-3/24', headerClass: 'text-center', class: 'flex justify-center' }
	];

	const sortedPlayers = $derived(
		match.current ? sortBy(match.current.players, 'index') : []
	);

	function getPlayerResult(player: MatchPlayer) {
		return match.current?.result?.players.find(
			(resultPlayer) => resultPlayer.profile_id === player.profile?.profile_id
		);
	}

	function getPlayerStats(player: MatchPlayer) {
		if (!match.current?.result) return undefined;
		return getLeaderboardStatsForPlayerByMatchType(match.current.result.matchtype_id, player);
	}

	function getPlayerRowClass(player: MatchPlayer) {
		const playerResult = getPlayerResult(player);
		return cn(
			'not-last:border-secondary-950 not-last:border-b',
			playerResult?.outcome === 0 ? 'bg-destructive/2!' : 'bg-success/2!'
		);
	}

	const hasReplay = $derived(!!(match.current?.hasReplay || match.current?.replay));

	const replayFile = resource(
		() => (hasReplay ? page.params.id : null),
		(id) => app.database.replays.getById(id!)
	);

	let isDownloading = $state(false);
	let didDownload = $derived(
		match.current && (await app.features.history.downloadExists(match.current))
	);

	const title = $derived(
		match.current?.isRanked
			? match.current?.title
			: match.current?.result
				? match.current?.result.description
				: match.current?.title
	);
	const player = $derived(
		match.current?.result?.players.find((p) =>
			match.current?.user.steamIds?.includes(p.steamId || '')
		)
	);
	const duration = $derived.by(() => {
		if (!match.current?.result?.startgametime || !match.current?.result?.completiontime) {
			return 'N/A';
		}
		const start = dayjs.unix(match.current.result.startgametime);
		const end = dayjs.unix(match.current.result.completiontime);
		const diff = dayjs.duration(end.diff(start));

		if (diff.hours() > 0) {
			return diff.format('H [hrs] m [mins] s [secs]');
		}

		return diff.format('m [mins] s [secs]');
	});

	const subscription = app.database.matches.subscribe(page.params.id!, (updatedMatch) => {
		match.mutate(updatedMatch);
	});

	onDestroy(() => {
		subscription.then((unsubscribe) => unsubscribe()).catch(() => undefined);
	});
</script>

<ButtonBack>Go back</ButtonBack>

{#if match.current}
	<Match.Root
		match={match.current}
		class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(180px,280px)_minmax(0,1fr)] lg:gap-6 xl:gap-8"
	>
		<div>
			<Match.MapImage />
		</div>
		<div class="py-4">
			<Match.MapName class="mb-6 block text-3xl font-bold" />
			<div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
				<List.Root>
					<List.Title>Status</List.Title>
					<List.Value class="flex items-center">
						{#if match.current?.needsResult}
							<HourGlass class="text-primary" {@attach tooltip('Result pending')} />
						{:else}
							<Checks class="text-green-400" {@attach tooltip('Result saved')} />
						{/if}
					</List.Value>
					<List.Title>Submitted at</List.Title>
					<List.Value>{dayjs(match.current.createdAt).format('DD MMM YYYY, HH:mm')}</List.Value>
					{#if player}
						<List.Title>Submitted by</List.Title>
						<List.Value>
							<a
								href={`/players/${player.profile_id}`}
								class="hover:text-primary-300 underline"
							>
								{player.alias}
							</a>
						</List.Value>
					{/if}
					<List.Title>Game Mode</List.Title>
					<List.Value>{match.current.isRanked ? 'Ranked' : 'Custom Match'}</List.Value>
				</List.Root>
				<List.Root>
					<List.Title>Title</List.Title>
					<List.Value><Match.Title /></List.Value>
					<List.Title>Player Count</List.Title>
					<List.Value>{match.current.players?.length}</List.Value>
					<List.Title>Duration</List.Title>
					<List.Value>{duration}</List.Value>
				</List.Root>
			</div>
			<div class="mt-6 flex gap-2">
				{#if hasReplay}
					<Button
						onclick={() => {
							isDownloading = true;
							app.features.history
								.downloadReplay(match.current!)
								.then(() => {
									isDownloading = false;
									didDownload = true;
								})
								.catch(() => {
									didDownload = false;
								})
								.finally(() => {
									isDownloading = false;
								});
						}}
						class={cn(didDownload && 'pointer-events-none cursor-not-allowed opacity-50')}
						loading={isDownloading}
					>
						{#if !isDownloading && !didDownload}
							<Download class="mr-2" />
						{/if}
						{#if didDownload}
							<span in:scale={{ easing: bounceInOut, duration: 150 }}>
								<Check size={22} class="mr-2" />
							</span>
						{/if}
						Download replay
					</Button>
				{/if}
			</div>
			<H level={3} class="mt-8 mb-4">Players</H>
			{#snippet cell_rating_change({ row }: { row: MatchPlayer })}
				<Player.RatingChange />
			{/snippet}
			{#snippet cell_elo({ row }: { row: MatchPlayer })}
				{getPlayerResult(row)?.newrating || 'N/A'}
			{/snippet}
			{#snippet cell_rank({ row }: { row: MatchPlayer })}
				<Player.Rank />
			{/snippet}
			{#snippet cell_name({ row }: { row: MatchPlayer })}
				<Player.Faction />
				<Player.Alias />
				<Player.Country class="w-6" />
			{/snippet}
			{#snippet cell_wins({ row }: { row: MatchPlayer })}
				<Player.Wins />
			{/snippet}
			{#snippet cell_losses({ row }: { row: MatchPlayer })}
				<Player.Losses />
			{/snippet}
			{#snippet cell_streak({ row }: { row: MatchPlayer })}
				<Player.Streak />
			{/snippet}
			{#snippet matchPlayerRowWrapper({ row, children }: { row: MatchPlayer; children: import('svelte').Snippet })}
				<Player.Root
					player={row}
					playerResult={getPlayerResult(row)}
					stats={getPlayerStats(row)}
				>
					{@render children()}
				</Player.Root>
			{/snippet}
			<DataTable
				data={sortedPlayers}
				columns={playerColumns}
				rowKey={(player) => player.profile?.profile_id ?? player.index}
				rowClass={getPlayerRowClass}
				rowWrapper={matchPlayerRowWrapper}
				cells={{
					rating_change: cell_rating_change,
					elo: cell_elo,
					rank: cell_rank,
					name: cell_name,
					wins: cell_wins,
					losses: cell_losses,
					streak: cell_streak
				}}
			/>

			{#if hasReplay}
				{#if replayFile.loading}
					<Replay.TabsSkeleton />
				{:else if replayFile.current}
					<H level={3} class="mt-8 mb-4">Replay</H>
					<Replay.Root file={replayFile.current} class="flex flex-col gap-4">
						<Replay.Tabs />
					</Replay.Root>
				{:else if replayFile.error}
					<H level={3} class="mt-8 mb-4">Replay</H>
					<p class="text-secondary-400 text-sm">Failed to load replay data.</p>
				{/if}
			{/if}
		</div>
	</Match.Root>
{/if}
