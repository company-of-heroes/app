<script lang="ts">
	import {
		attachLiveLobbyStats,
		getLiveLobbyMatchTypeId,
		toLiveLobbyRecord,
		type LiveLobby,
		type LiveLobbyPlayer
	} from '@company-of-heroes/ui/live-lobby';
	import {
		ListTable as MatchListTable,
		LIVE_MATCH_LIST_COLUMNS,
		toMatchListRowFromLiveLobby
	} from '@company-of-heroes/ui/match';
	import type { LiveLobby as AppLiveLobby } from '$core/app/database/lobbies-live';
	import WidgetPanel from './widget-panel.svelte';
	import { LiveLobbiesFeed } from './live-lobbies.svelte';
	import { MATCH_TYPES } from '$core/game/lobby';
	import { app } from '$core/app/context';
	import { PUBLIC_PB_URL } from '$env/static/public';
	import { fetch } from '$core/http/fetch';
	import { Button } from '$lib/components/ui/button';
	import { useI18n } from '$lib/i18n';
	import dayjs from '$lib/dayjs';
	import { getFactionFlagFromRace, getRankImage, normalizeMapName } from '$lib/utils';
	import { getDefaultMapImage, getMapImageFromName } from '$lib/utils/game';

	const { t } = useI18n();
	const feed = new LiveLobbiesFeed();
	const isDev = import.meta.env.DEV;
	let seeding = $state(false);

	const lobbies = $derived(
		feed.items
			.map((lobby) => toUiLiveLobby(lobby))
			.filter((lobby): lobby is LiveLobby => lobby != null)
	);

	const rows = $derived(lobbies.map(toMatchListRowFromLiveLobby));

	const meSteamIds = $derived(
		(app.features.auth.user.steamIds ?? []).filter(Boolean) as string[]
	);

	$effect(() => {
		void feed.start();
		return () => {
			void feed.stop();
		};
	});

	function toUiLiveLobby(lobby: AppLiveLobby): LiveLobby | null {
		const record = toLiveLobbyRecord({
			id: lobby.id,
			lobbyId: lobby.lobby ?? null,
			sessionId: lobby.sessionId,
			map: lobby.map,
			isRanked: lobby.isRanked,
			isReplay: lobby.isReplay,
			matchType: lobby.matchType,
			createdAt: lobby.createdAt,
			updatedAt: lobby.updatedAt,
			hostName: lobby.user?.name ?? lobby.user?.email ?? '',
			players: lobby.players
		});
		if (!record) {
			return null;
		}

		const matchTypeId = getLiveLobbyMatchTypeId(
			record.players,
			record.isRanked,
			record.matchType
		);

		return {
			...record,
			players: attachLiveLobbyStats(
				record.players,
				lobby.players,
				record.isRanked,
				record.matchType
			),
			modeLabel: t(MATCH_TYPES[matchTypeId as keyof typeof MATCH_TYPES] ?? 'Custom Game')
		};
	}

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

	function detailsHref(row: { lobbyId?: string | null }) {
		if (!row.lobbyId) {
			return null;
		}

		return `/history/${row.lobbyId}`;
	}

	function seedUrl() {
		return `${(PUBLIC_PB_URL ?? 'https://api.coh1stats.com').replace(/\/$/, '')}/api/dev/live-lobbies/seed`;
	}

	async function seedTestLobbies() {
		seeding = true;
		try {
			const response = await fetch(seedUrl(), { method: 'POST' });
			if (!response.ok) {
				throw new Error(await response.text());
			}

			await feed.refresh();
			app.toast.success(t('Seeded test live lobbies.'));
		} catch (error) {
			console.warn('[LIVE_LOBBIES]: seed failed:', error);
			app.toast.error(t('Could not seed test live lobbies.'));
		} finally {
			seeding = false;
		}
	}

	async function clearTestLobbies() {
		seeding = true;
		try {
			const response = await fetch(seedUrl(), { method: 'DELETE' });
			if (!response.ok) {
				throw new Error(await response.text());
			}

			await feed.refresh();
			app.toast.success(t('Cleared test live lobbies.'));
		} catch (error) {
			console.warn('[LIVE_LOBBIES]: clear seed failed:', error);
			app.toast.error(t('Could not clear test live lobbies.'));
		} finally {
			seeding = false;
		}
	}
</script>

<WidgetPanel
	title={t('Live lobbies')}
	summary={feed.isLoading ? undefined : t('{count} active', { count: rows.length })}
>
	{#if isDev}
		<div class="border-secondary-800 flex items-center gap-2 border-b px-4 py-2">
			<Button size="sm" variant="secondary" disabled={seeding} onclick={seedTestLobbies}>
				{t('Seed test')}
			</Button>
			<Button size="sm" variant="ghost" disabled={seeding} onclick={clearTestLobbies}>
				{t('Clear test')}
			</Button>
		</div>
	{/if}
	{#if feed.error}
		<p class="border-secondary-800 text-red-400 border-b px-4 py-2 text-sm">
			{t('Could not load live lobbies.')}
		</p>
	{/if}
	<MatchListTable
		{rows}
		loading={feed.isLoading}
		columns={LIVE_MATCH_LIST_COLUMNS}
		{meSteamIds}
		resolveMapSrc={getMapImageFromName}
		resolveFallbackSrc={getDefaultMapImage}
		resolveFactionFlag={getFactionFlagFromRace}
		getRankImage={getRankImage}
		formatMapName={normalizeMapName}
		formatStarted={(createdAt: string) => dayjs(createdAt).fromNow()}
		{playerHref}
		{playerLabel}
		{detailsHref}
		emptyMessage={feed.error
			? t('Could not load live lobbies.')
			: t('No community members are in a match right now.')}
		mapLabel={t('Map')}
		nameLabel={t('Name')}
		typeLabel={t('Type')}
		alliesLabel={t('Allies')}
		axisLabel={t('Axis')}
		hostLabel={t('Host')}
		startedLabel={t('Started at')}
		unknownHostLabel={t('Unknown')}
		detailsLabel={t('Details')}
		eloLabel={t('ELO')}
		levelLabel={t('Level')}
		posLabel={t('Pos')}
		winsLabel={t('W')}
		lossesLabel={t('L')}
		streakLabel={t('Streak')}
	/>
</WidgetPanel>
