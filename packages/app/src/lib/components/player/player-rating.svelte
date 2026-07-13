<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { usePlayer } from '.';
	import { cn } from '$lib/utils';
	import { getPlayerEloFromMatchHistory } from '$lib/utils/game';

	type Props = HTMLAttributes<HTMLSpanElement> & {
		matchType?: number;
	};

	const { matchType, ...restProps }: Props = $props();
	const { playerResult, player } = $derived(usePlayer());
	const rating = $derived.by(() => {
		if (playerResult?.newrating && playerResult.newrating >= 1) {
			return playerResult.newrating;
		}
		if (matchType === undefined) return undefined;
		return getPlayerEloFromMatchHistory(matchType, player) ?? undefined;
	});
</script>

<span {...restProps} class={cn('text-center tabular-nums', restProps.class)}>
	{rating ?? 'N/A'}
</span>
