<script lang="ts">
	import * as List from '$lib/components/ui/list';
	import * as Player from '$lib/components/player';
	import * as Table from '$lib/components/ui/table';
	import * as Match from '$lib/components/match';
	import * as Comments from '$lib/components/comments';
	import { scale } from 'svelte/transition';
	import { page } from '$app/state';
	import { app } from '$core/app/context';
	import { Button, ButtonBack } from '$lib/components/ui/button';
	import { H } from '$lib/components/ui/h';
	import { cn, normalizeMapName } from '$lib/utils';
	import { getLeaderboardStatsForPlayerByMatchType, getMapImageFromName } from '$lib/utils/game';
	import { resource } from 'runed';
	import { tooltip } from '$lib/attachments';
	import { sortBy } from 'lodash-es';
	import dayjs from '$lib/dayjs';
	import HourGlass from 'phosphor-svelte/lib/Hourglass';
	import Checks from 'phosphor-svelte/lib/Checks';
	import Download from 'phosphor-svelte/lib/Download';
	import TreeView from 'phosphor-svelte/lib/TreeView';
	import Check from 'phosphor-svelte/lib/Check';
	import { bounceInOut, elasticInOut } from 'svelte/easing';
	import type { fr } from 'zod/v4/locales';
	import Comment from '$lib/components/comment/comment.svelte';
	import { Editor } from '$lib/components/ui/editor';

	const match = resource(
		() => page.params.id,
		() => app.database.matches.getById(page.params.id!)
	);

	$inspect(match.current);

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
</script>

<ButtonBack>Go back</ButtonBack>

{#if match.current}
	<Match.Root match={match.current} class="grid grid-cols-[300px_auto] gap-8">
		<div>
			<Match.MapImage />
		</div>
		<div class="py-4">
			<Match.MapName class="mb-6 block text-3xl font-bold" />
			<div class="grid grid-cols-2 items-start">
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
								href={`/leaderboards/profile/${player.profile_id}`}
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
				<Button variant="secondary" href={`/replays/${match.current.id}`}>
					<TreeView class="mr-2" />
					View replay
				</Button>
			</div>
			<H level={3} class="mt-8 mb-4">Players</H>
			<Table.Table>
				<Table.THead>
					<Table.tr>
						<Table.TH width="2/24">-</Table.TH>
						<Table.TH width="2/24" class="flex justify-center">ELO</Table.TH>
						<Table.TH width="2/24" class="flex justify-center">Rank</Table.TH>
						<Table.TH width="9/24">Name</Table.TH>
						<Table.TH width="3/24" class="flex justify-center">Wins</Table.TH>
						<Table.TH width="3/24" class="flex justify-center">Losses</Table.TH>
						<Table.TH width="3/24" class="flex justify-center">Streak</Table.TH>
					</Table.tr>
				</Table.THead>
				{#each sortBy(match.current.players, 'index') as player}
					{@const playerResult = match.current.result?.players.find(
						(p) => p.profile_id === player.profile?.profile_id
					)}
					{@const stats = match.current.result
						? getLeaderboardStatsForPlayerByMatchType(match.current.result.matchtype_id, player)
						: undefined}

					<Table.TR
						class={cn(
							'not-last:border-secondary-950 not-last:border-b',
							playerResult?.outcome === 0 ? 'bg-destructive/2!' : 'bg-success/2!'
						)}
					>
						<Player.Root {player} {playerResult} {stats}>
							<Table.TD width="2/24" class="flex justify-center">
								<Player.RatingChange />
							</Table.TD>
							<Table.TD width="2/24" class="flex justify-center">
								{playerResult?.newrating || 'N/A'}
							</Table.TD>
							<Table.TD width="2/24" class="flex justify-center">
								<Player.Rank />
							</Table.TD>
							<Table.TD width="9/24" class="flex items-center gap-4">
								<Player.Faction />
								<Player.Alias />
								<Player.Country class="w-6" />
							</Table.TD>
							<Table.TD width="3/24" class="flex justify-center">
								<Player.Wins />
							</Table.TD>
							<Table.TD width="3/24" class="flex justify-center">
								<Player.Losses />
							</Table.TD>
							<Table.TD width="3/24" class="flex justify-center">
								<Player.Streak />
							</Table.TD>
						</Player.Root>
					</Table.TR>
				{/each}
			</Table.Table>
		</div>
	</Match.Root>
{/if}
