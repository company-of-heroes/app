<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import * as Player from '$lib/components/player';
	import { useMatch } from '.';
	import { cn } from '$lib/utils';
	import { tooltip } from '$lib/attachments';
	import { Race } from '$lib/utils/game';
	import { app } from '$core/app/context';
	import { intersection } from 'lodash-es';

	type Props = {
		team: 'allies' | 'axis';
		outcome?: 'win' | 'loss';
		highlightedPlayers?: string[];
	} & HTMLAttributes<HTMLSpanElement>;

	let { team, outcome = $bindable(), highlightedPlayers = [], ...restProps }: Props = $props();
	let match = useMatch();
	let players = $derived(
		team === 'allies'
			? match.players?.filter((p) => p.race === Race.US || p.race === Race.Commonwealth) || []
			: match.players?.filter((p) => p.race === Race.Wehrmacht || p.race === Race.PanzerElite) || []
	);

	$effect(() => {
		const player = match.result?.players.find((p) =>
			players.find((pl) => pl.playerId === p.profile_id)
		);

		if (player) {
			const newOutcome = player.outcome === 0 ? 'loss' : 'win';
			if (outcome !== newOutcome) {
				outcome = newOutcome;
			}
		}
	});
</script>

<span {...restProps} class={cn('flex items-center gap-2', restProps.class)}>
	{#each players as player}
		{@const isHighlighted =
			intersection(highlightedPlayers, [player.playerId.toString(), player.steamId]).length > 0}
		{@const isMe = intersection(app.features.auth.user?.steamIds, [player.steamId]).length > 0}

		<Player.Root {player}>
			<a href={`/leaderboards/profile/${player.steamId}`}>
				<Player.Faction
					{@attach tooltip(player.profile?.alias || 'Unknown')}
					class={cn(
						isMe || isHighlighted ? 'grayscale-0' : 'opacity-50 grayscale-80',
						isMe && 'ring-blue-500',
						'hover:opacity-100 hover:grayscale-0'
					)}
				/>
			</a>
		</Player.Root>
	{/each}
</span>
