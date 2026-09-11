<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { MatchExpanded } from '$core/app/database/matches';
	import type { LiveLobbyPlayer } from '@company-of-heroes/ui/live-lobby';
	import {
		ListTable as SharedMatchListTable,
		type MatchListColumnId,
		type MatchListRow
	} from '@company-of-heroes/ui/match';
	import MatchLobbyPlayers from '$lib/components/widgets/match-lobby-players.svelte';
	import { getMatchModeLabel } from '$lib/components/widgets/dashboard-utils';
	import { toUiMatchListRow } from './match-view';
	import { app } from '$core/app/context';
	import dayjs from '$lib/dayjs';
	import { normalizeMapName, getFactionFlagFromRace } from '$lib/utils';
	import { getDefaultMapImage, getMapImageFromName } from '$lib/utils/game';
	import { useI18n } from '$lib/i18n';

	type Props = {
		matches: MatchExpanded[];
		loading?: boolean;
		columns?: MatchListColumnId[];
		showMap?: boolean;
		showRating?: boolean;
		expandable?: boolean;
		highlightedPlayers?: string[];
		emptyMessage?: string;
		class?: string;
		footer?: Snippet;
		expandContent?: Snippet<[{ row: MatchListRow; match: MatchExpanded }]>;
		detailsHref?: (row: MatchExpanded) => string | undefined | null;
	};

	let {
		matches,
		loading = false,
		columns: columnIds,
		showMap = true,
		showRating = true,
		expandable = true,
		highlightedPlayers = [],
		emptyMessage,
		class: className,
		footer,
		expandContent,
		detailsHref
	}: Props = $props();
	const { t } = useI18n();

	const meSteamIds = $derived(
		(app.features.auth.user.steamIds ?? []).filter(Boolean) as string[]
	);

	const matchById = $derived(new Map(matches.map((match) => [match.id, match])));

	const resolvedColumns = $derived.by((): MatchListColumnId[] => {
		if (columnIds?.length) {
			return columnIds.includes('expand') || !expandable
				? columnIds
				: [...columnIds, 'expand'];
		}

		const ids: MatchListColumnId[] = [];
		if (showMap) ids.push('map');
		ids.push('name', 'type', 'allies', 'axis', 'duration');
		if (showRating) ids.push('rating');
		ids.push('actions');
		if (expandable) ids.push('expand');
		return ids;
	});

	const rows = $derived(
		matches.map((match) =>
			toUiMatchListRow(match, {
				profileId: highlightedPlayers[0],
				modeLabel: getMatchModeLabel(match)
			})
		)
	);

	function playerHref(player: LiveLobbyPlayer) {
		if (player.playerId === -1) {
			return null;
		}

		if (player.profileId) {
			return `/players/${player.profileId}`;
		}

		if (player.steamId) {
			return `/players/${player.steamId}`;
		}

		return null;
	}

	function playerLabel(player: LiveLobbyPlayer) {
		if (player.playerId === -1) {
			const alias = player.alias.trim();
			if (alias && /^cpu(\b|\s*[-–—])/i.test(alias)) {
				return alias;
			}

			return t('CPU opponent');
		}

		if (player.alias.trim()) {
			return player.alias.trim();
		}

		return t('Player {n}', { n: player.index + 1 });
	}

	function rowDetailsHref(row: MatchListRow) {
		const match = matchById.get(row.id);
		if (!match) {
			return null;
		}

		if (detailsHref) {
			return detailsHref(match) ?? null;
		}

		return `/history/${match.id}`;
	}

	function formatStarted(createdAt: string) {
		return dayjs(createdAt).fromNow();
	}

	function formatDate(createdAt: string) {
		return new Date(createdAt).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

{#snippet defaultExpand({ row }: { row: MatchListRow })}
	{@const match = matchById.get(row.id)}
	{#if expandContent && match}
		{@render expandContent({ row, match })}
	{:else if match}
		<MatchLobbyPlayers {match} />
	{/if}
{/snippet}

<SharedMatchListTable
	{rows}
	{loading}
	columns={resolvedColumns}
	{meSteamIds}
	{highlightedPlayers}
	resolveMapSrc={getMapImageFromName}
	resolveFallbackSrc={getDefaultMapImage}
	resolveFactionFlag={getFactionFlagFromRace}
	formatMapName={normalizeMapName}
	{formatStarted}
	{formatDate}
	{playerHref}
	{playerLabel}
	detailsHref={rowDetailsHref}
	expandContent={expandable ? defaultExpand : undefined}
	{emptyMessage}
	class={className}
	{footer}
	mapLabel={t('Map')}
	nameLabel={t('Name')}
	typeLabel={t('Type')}
	alliesLabel={t('Allies')}
	axisLabel={t('Axis')}
	hostLabel={t('Host')}
	startedLabel={t('Started at')}
	dateLabel={t('Date')}
	durationLabel={t('Duration')}
	ratingLabel={t('Rating')}
	unknownHostLabel={t('Unknown')}
	detailsLabel={t('Details')}
	eloLabel={t('ELO')}
	levelLabel={t('Level')}
	posLabel={t('Pos')}
	winsLabel={t('W')}
	lossesLabel={t('L')}
	streakLabel={t('Streak')}
/>
