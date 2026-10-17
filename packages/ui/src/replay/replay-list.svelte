<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import ReplayCardGrid from '../replay-browse/replay-card-grid.svelte';
	import type { CommunityMatch, HistorySortDir, HistorySortField } from './types';

	type Props = {
		matches: CommunityMatch[];
		highlightedPlayers?: string[];
		meSteamIds?: string[];
		sort: HistorySortField;
		sortDir: HistorySortDir;
		onSort: (field: HistorySortField) => void;
		emptyMessage?: string;
		/** Kept for callers; the card grid has no column headers. */
		mapLabel?: string;
		/** Likes, comments and downloads; off for hosts without community data (local replays). */
		showEngagement?: boolean;
		/** Show only this many full rows of cards (the rest is hidden). */
		rows?: 1 | 2;
	};

	const { t } = useI18n();

	let {
		matches,
		highlightedPlayers = [],
		meSteamIds = [],
		emptyMessage = t('No community replays found.'),
		showEngagement = true,
		rows
	}: Props = $props();
</script>

{#if matches.length === 0}
	<p class="text-secondary-400 px-4 py-10 text-center text-sm">{emptyMessage}</p>
{:else}
	<ReplayCardGrid {matches} {meSteamIds} {highlightedPlayers} {showEngagement} {rows} closing />
{/if}
