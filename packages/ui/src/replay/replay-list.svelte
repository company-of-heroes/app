<script lang="ts">
	import { useI18n } from '@company-of-heroes/i18n';
	import ReplayCardGrid from '../replay-browse/replay-card-grid.svelte';
	import ReplayTable from './replay-table.svelte';
	import type { CommunityMatch, HistorySortDir, HistorySortField, ReplayLayout } from './types';

	type Props = {
		matches: CommunityMatch[];
		highlightedPlayers?: string[];
		meSteamIds?: string[];
		sort: HistorySortField;
		sortDir: HistorySortDir;
		onSort: (field: HistorySortField) => void;
		emptyMessage?: string;
		/** First column header in the list layout. */
		mapLabel?: string;
		/** Likes, comments and downloads; off for hosts without community data (local replays). */
		showEngagement?: boolean;
		/** Show only this many full rows of cards (the rest is hidden). */
		rows?: 1 | 2;
		/** Cards (default) or the table rows. */
		layout?: ReplayLayout;
	};

	const { t } = useI18n();

	let {
		matches,
		highlightedPlayers = [],
		meSteamIds = [],
		emptyMessage = t('No community replays found.'),
		mapLabel,
		showEngagement = true,
		rows,
		layout = 'grid'
	}: Props = $props();
</script>

{#if matches.length === 0}
	<p class="text-secondary-400 px-4 py-10 text-center text-sm">{emptyMessage}</p>
{:else if layout === 'list'}
	<ReplayTable {matches} {highlightedPlayers} {meSteamIds} {mapLabel} {showEngagement} />
{:else}
	<ReplayCardGrid {matches} {meSteamIds} {highlightedPlayers} {showEngagement} {rows} closing />
{/if}
