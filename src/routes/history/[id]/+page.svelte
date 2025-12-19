<script lang="ts">
	import * as List from '$lib/components/ui/list';
	import * as Player from '$lib/components/player';
	import * as Table from '$lib/components/ui/table';
	import { page } from '$app/state';
	import { app } from '$core/app';
	import { ButtonBack } from '$lib/components/ui/button';
	import { H } from '$lib/components/ui/h';
	import { cn, normalizeMapName } from '$lib/utils';
	import { getMapImageFromName, Race } from '$lib/utils/game';
	import { resource } from 'runed';
	import { tooltip } from '$lib/attachments';
	import dayjs from '$lib/dayjs';
	import HourGlass from 'phosphor-svelte/lib/Hourglass';
	import Checks from 'phosphor-svelte/lib/Checks';
	import CaretUp from 'phosphor-svelte/lib/CaretUp';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';

	const match = resource(
		() => page.params.id,
		() => app.database.lobbies.getById(page.params.id!)
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

	const getTeamPlayers = (team: 'allies' | 'axis') => {
		if (!match.current?.result?.players) {
			return [];
		}

		if (team === 'allies') {
			return match.current.result.players.filter(
				(p) => p.race_id === Race.US || p.race_id === Race.Commonwealth
			);
		}

		return match.current.result.players.filter(
			(p) => p.race_id === Race.Wehrmacht || p.race_id === Race.PanzerElite
		);
	};
</script>

<ButtonBack>Go back</ButtonBack>

{#if match.current}
	<div class="grid grid-cols-[300px_auto] gap-8">
		<img src={getMapImageFromName(match.current.map)} alt={match.current.map} />
		<div class="py-4">
			<H level={2} class="mb-4">{normalizeMapName(match.current.map)}</H>
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
					<List.Value>{title}</List.Value>
					<List.Title>Player Count</List.Title>
					<List.Value>{match.current.players?.length}</List.Value>
					<List.Title>Duration</List.Title>
					<List.Value>{duration}</List.Value>
				</List.Root>
			</div>
			{#if match.current.result}
				{@const allies = getTeamPlayers('allies')}
				{@const axis = getTeamPlayers('axis')}
				<H level={3} class="mt-8 mb-4">Players</H>
				<Table.Table>
					<Table.THead>
						<Table.TH width="2/24"></Table.TH>
						<Table.TH width="8/24">Name</Table.TH>
						<Table.TH width="3/24" class="flex justify-center">Wins</Table.TH>
						<Table.TH width="3/24" class="flex justify-center">Losses</Table.TH>
					</Table.THead>
					{#each allies as player}
						<Table.TR
							class={cn(
								'not-last:border-secondary-950 not-last:border-b',
								player.resulttype === 0 ? 'bg-destructive/2!' : 'bg-success/2!'
							)}
						>
							<Player.Root {player}>
								<Table.TD width="2/24" class="flex justify-center">
									<Player.RatingChange />
								</Table.TD>
								<Table.TD width="8/24" class="flex items-center gap-4">
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
							</Player.Root>
						</Table.TR>
					{/each}
					{#each axis as player}
						<Table.TR
							class={cn(
								'not-last:border-secondary-950 not-last:border-b',
								player.resulttype === 0 ? 'bg-destructive/2!' : 'bg-success/2!'
							)}
						>
							<Player.Root {player}>
								<Table.TD width="2/24" class="flex justify-center">
									<Player.RatingChange />
								</Table.TD>
								<Table.TD width="8/24" class="flex items-center gap-4">
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
							</Player.Root>
						</Table.TR>
					{/each}
				</Table.Table>
			{/if}
		</div>
	</div>
{/if}
