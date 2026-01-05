<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import * as Player from '$lib/components/player';
	import { useMatch } from '.';
	import { cn } from '$lib/utils';
	import { tooltip } from '$lib/attachments';
	import { Race } from '$lib/utils/game';

	type Props = {
		team: 'allies' | 'axis';
	} & HTMLAttributes<HTMLSpanElement>;

	const { team, ...restProps }: Props = $props();
	const match = useMatch();
	const players = $derived(
		team === 'allies'
			? match.players?.filter((p) => p.race === Race.US || p.race === Race.Commonwealth) || []
			: match.players?.filter((p) => p.race === Race.Wehrmacht || p.race === Race.PanzerElite) || []
	);
</script>

<span {...restProps} class={cn('flex items-center gap-2', restProps.class)}>
	{#each players as player}
		<Player.Root {player}>
			<a href={`/leaderboards/profile/${player.steamId}`}>
				<Player.Faction {@attach tooltip(player.profile?.alias || 'Unknown')} />
			</a>
		</Player.Root>
	{/each}
</span>
