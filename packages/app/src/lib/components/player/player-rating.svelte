<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import { cn } from '$lib/utils';
	import { getPlayerEloFromMatchHistory } from '$lib/utils/game';
	import { getStoredEloRating } from '$lib/utils/player-elo';
	import {
		getEloColor,
		getEloTextShadow,
		isEliteElo
	} from '$lib/components/leaderboard/leaderboard-utils';

	type Props = HTMLAttributes<HTMLSpanElement> & {
		matchType?: number;
	};

	const { matchType, ...restProps }: Props = $props();
	const { playerResult, player } = $derived(usePlayer());
	const rating = $derived.by(() => {
		if (playerResult?.newrating && playerResult.newrating >= 1) {
			return playerResult.newrating;
		}

		if (matchType === undefined) {
			return undefined;
		}

		return (
			getPlayerEloFromMatchHistory(matchType, player) ??
			getStoredEloRating(player.storedElo, matchType, player.race) ??
			undefined
		);
	});
</script>

<span
	{...restProps}
	class={cn(
		'text-center tabular-nums',
		restProps.class,
		rating == null && 'text-secondary-500 text-xs font-normal',
		isEliteElo(rating) && 'font-bold tracking-wide'
	)}
	style:color={rating != null ? getEloColor(rating) : undefined}
	style:text-shadow={getEloTextShadow(rating)}
>
	{rating ?? 'N/A'}
</span>
