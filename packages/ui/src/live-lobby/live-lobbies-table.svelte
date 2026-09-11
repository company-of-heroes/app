<script lang="ts">
	import {
		ListTable as SharedMatchListTable,
		LIVE_MATCH_LIST_COLUMNS,
		toMatchListRowFromLiveLobby,
		type MatchListColumnId,
		type MatchListRow
	} from '@company-of-heroes/ui/match';
	import type { LiveLobby, LiveLobbyPlayer } from '@company-of-heroes/ui/live-lobby';

	type Props = {
		lobbies: LiveLobby[];
		loading?: boolean;
		meSteamIds?: string[];
		resolveMapSrc: (map: string | undefined) => string | undefined;
		resolveFallbackSrc?: () => string | undefined;
		resolveFactionFlag: (race: number) => string;
		getRankImage?: (race: number, rankLevel: number) => string;
		formatMapName: (map: string) => string;
		formatStarted: (createdAt: string) => string;
		playerHref: (player: LiveLobbyPlayer) => string | null;
		playerLabel?: (player: LiveLobbyPlayer) => string;
		detailsHref?: (lobby: LiveLobby) => string | null;
		emptyMessage?: string;
		mapLabel?: string;
		nameLabel?: string;
		typeLabel?: string;
		alliesLabel?: string;
		axisLabel?: string;
		hostLabel?: string;
		startedLabel?: string;
		unknownHostLabel?: string;
		detailsLabel?: string;
		eloLabel?: string;
		levelLabel?: string;
		posLabel?: string;
		winsLabel?: string;
		lossesLabel?: string;
		streakLabel?: string;
	};

	let {
		lobbies,
		loading = false,
		meSteamIds = [],
		resolveMapSrc,
		resolveFallbackSrc,
		resolveFactionFlag,
		getRankImage,
		formatMapName,
		formatStarted,
		playerHref,
		playerLabel,
		detailsHref,
		emptyMessage,
		mapLabel,
		nameLabel,
		typeLabel,
		alliesLabel,
		axisLabel,
		hostLabel,
		startedLabel,
		unknownHostLabel,
		detailsLabel,
		eloLabel,
		levelLabel,
		posLabel,
		winsLabel,
		lossesLabel,
		streakLabel
	}: Props = $props();

	const rows = $derived(lobbies.map(toMatchListRowFromLiveLobby));
	const lobbyById = $derived(new Map(lobbies.map((lobby) => [lobby.id, lobby])));
	const columns: MatchListColumnId[] = LIVE_MATCH_LIST_COLUMNS;

	function rowDetailsHref(row: MatchListRow) {
		const lobby = lobbyById.get(row.id);
		if (!lobby || !detailsHref) {
			return null;
		}

		return detailsHref(lobby);
	}
</script>

<SharedMatchListTable
	{rows}
	{loading}
	{columns}
	{meSteamIds}
	{resolveMapSrc}
	{resolveFallbackSrc}
	{resolveFactionFlag}
	{getRankImage}
	{formatMapName}
	{formatStarted}
	{playerHref}
	{playerLabel}
	detailsHref={detailsHref ? rowDetailsHref : undefined}
	{emptyMessage}
	{mapLabel}
	{nameLabel}
	{typeLabel}
	{alliesLabel}
	{axisLabel}
	{hostLabel}
	{startedLabel}
	{unknownHostLabel}
	{detailsLabel}
	{eloLabel}
	{levelLabel}
	{posLabel}
	{winsLabel}
	{lossesLabel}
	{streakLabel}
/>
