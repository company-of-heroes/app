<script lang="ts">
	import { resource } from 'runed';
	import type { CommunityMatch, HistoryMatchup } from '@company-of-heroes/ui/replay';
	import { MatchupSections, type MatchupGroup } from '@company-of-heroes/ui/replay-browse';
	import { app } from '$core/app/context';
	import type { Matches } from '$core/app/features/history/matches.svelte';
	import { matchtypesForMatchups } from '$core/app/features/history/matches.svelte';
	import {
		historyListHref,
		historyListStateFromMatches
	} from '$core/app/features/history/history-url';
	import { getMeSteamIds } from '$lib/utils/player-me';

	type Props = {
		matches: Matches;
	};

	const MATCHUPS: HistoryMatchup[] = ['1v1', '2v2', '3v3', '4v4'];
	/** Cards per game type. */
	const GROUP_SIZE = 12;

	let { matches }: Props = $props();
	const mySteamIds = $derived(getMeSteamIds());

	// Refetches when the other filters (ranked, pro, maps, …) or the sort change.
	const groups = resource(
		() => JSON.stringify(matches.query),
		async (): Promise<MatchupGroup[]> =>
			Promise.all(
				MATCHUPS.map(async (matchup) => {
					const page = await app.database.matches.getHistoryList(1, GROUP_SIZE, {
						...matches.query,
						matchtypes: matchtypesForMatchups([matchup])
					});
					return { matchup, items: page.items as unknown as CommunityMatch[] };
				})
			)
	);

	function viewAllHref(matchup: HistoryMatchup) {
		const state = historyListStateFromMatches(matches);
		return historyListHref(
			{ ...state, page: 1, filters: { ...state.filters, matchups: [matchup], filter: undefined } },
			'community'
		);
	}
</script>

<MatchupSections groups={groups.current ?? null} {viewAllHref} meSteamIds={mySteamIds} />
