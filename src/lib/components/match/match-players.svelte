<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useMatch } from '.';
	import { cn, getFactionFlagFromRace, getRacePrefix } from '$lib/utils';
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

<span {...restProps} class={cn('flex items-center gap-0.5', restProps.class)}>
	{#each players as player}
		<img
			src={getFactionFlagFromRace(player.race)}
			alt={getRacePrefix(player.race)}
			class={cn('border-secondary-800 size-5 rounded-full border-3 object-cover')}
			{@attach tooltip(player.profile?.alias || 'Unknown')}
		/>
	{/each}
</span>
