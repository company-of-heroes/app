<script lang="ts">
	import type { MatchExpanded } from '$core/app/database/matches';
	import type { TransformedMatch } from '@fknoobs/app';
	import { app } from '$core/app/context';
	import LobbyPlayersGrid from './lobby-players-grid.svelte';
	import { getLiveLobbyMatchType } from './dashboard-utils';

	type Props = {
		match: MatchExpanded;
	};

	let { match }: Props = $props();

	const matchType = $derived(getLiveLobbyMatchType(match.players ?? [], match.isRanked));
	const result = $derived(match.result as TransformedMatch | null | undefined);
	const highlightPlayerId = $derived(app.game.profile?.relic.profile_id);
</script>

<LobbyPlayersGrid
	players={match.players ?? []}
	{matchType}
	{highlightPlayerId}
	{result}
/>
