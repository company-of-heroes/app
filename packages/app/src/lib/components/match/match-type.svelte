<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { useMatch } from '.';
	import { cn } from '$lib/utils';
	import { getMatchModeLabel } from '$lib/components/widgets/dashboard-utils';
	import type { MatchExpanded } from '$core/app/database/matches';

	type Props = HTMLAttributes<HTMLSpanElement>;

	const { ...restProps }: Props = $props();
	const match = useMatch();
	const label = $derived(
		match.modeLabel ||
			getMatchModeLabel({
				players: match.players,
				isRanked: match.isRanked
			} as MatchExpanded)
	);
</script>

<span {...restProps} class={cn('truncate', restProps.class)}>{label}</span>
