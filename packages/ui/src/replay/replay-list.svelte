<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import MatchRow from '../replay-browse/match-row.svelte';
	import type { CommunityMatch, HistorySortDir, HistorySortField } from './types';

	type Props = {
		matches: CommunityMatch[];
		highlightedPlayers?: string[];
		meSteamIds?: string[];
		sort: HistorySortField;
		sortDir: HistorySortDir;
		onSort: (field: HistorySortField) => void;
		emptyMessage?: string;
		/** Kept for callers; the face-off rows have no column headers. */
		mapLabel?: string;
		/** Likes, comments and downloads; off for hosts without community data (local replays). */
		showEngagement?: boolean;
	};

	const { t } = useI18n();

	let {
		matches,
		highlightedPlayers = [],
		meSteamIds = [],
		emptyMessage = t('No community replays found.'),
		showEngagement = true
	}: Props = $props();
</script>

{#if matches.length === 0}
	<p class="text-secondary-400 px-4 py-10 text-center text-sm">{emptyMessage}</p>
{:else}
	<!-- Each row closes with its own line; the list overlaps the parent's closing border. -->
	<div class="-mb-px">
		{#each matches as match (match.id)}
			<MatchRow {match} {meSteamIds} {highlightedPlayers} {showEngagement} />
		{/each}
	</div>
{/if}
