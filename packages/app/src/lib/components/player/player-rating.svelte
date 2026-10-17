<script lang="ts">
	import { EloBadge } from '@company-of-heroes/ui/player';
	import { usePlayer } from '.';
	import { getPlayerEloFromMatchHistory } from '$lib/utils/game';
	import { getStoredEloRating } from '$lib/utils/player-elo';

	type Props = {
		matchType?: number;
		class?: string;
	};

	const { matchType, class: className }: Props = $props();
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

<!-- Badge beside the player name, as on the leaderboards. -->
<EloBadge elo={rating} class={className} />
