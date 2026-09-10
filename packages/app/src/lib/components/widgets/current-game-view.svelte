<script lang="ts">
	import type { LobbyPlayer } from '@fknoobs/app';
	import type { Match } from '$core/game/lobby';
	import {
		Overview,
		type CommunityMatchDetail,
		type CommunityPlayer,
		type ReplayData
	} from '@company-of-heroes/ui/replay';
	import type { LiveLobbyPlayer } from '@company-of-heroes/ui/live-lobby';
	import * as List from '$lib/components/ui/list';
	import * as PlayerUi from '$lib/components/player';
	import MapImage from '$lib/components/ui/map-image.svelte';
	import { LiveBadge } from '$lib/components/ui/badge';
	import { SetCrumbs } from '$lib/components/ui/breadcrumb';
	import { getFactionFlagFromRace, getRankImage, normalizeMapName } from '$lib/utils';
	import { doctrineBannerUrl, raceFromReplayFaction } from '$lib/utils/replay-doctrine';
	import { detailMetaGrid } from '$lib/components/ui/variants';
	import { formatStreak } from '@company-of-heroes/ui/variants';
	import { getPlayerRatings } from '$core/pocketbase/player-ratings';
	import { getStoredEloRating, isValidSteamId } from '$lib/utils/player-elo';
	import { getLeaderboardStatsForPlayerByMatchType, getPlayerEloFromMatchHistory } from '$lib/utils/game';
	import { loadSmurfAlert, type SmurfAlertState } from '$lib/player/smurf';
	import { loadCheaterSteamIds } from '$core/pocketbase/anti-cheat';
	import {
		getCountryDisplayName,
		getEloColor,
		getEloTextShadow
	} from '$lib/components/leaderboard/leaderboard-utils';
	import { app } from '$core/app/context';
	import { resource } from 'runed';
	import {
		getAlliesPlayers,
		getAxisPlayers,
		getPlayerAlias,
		getPlayerProfileId,
		isHighlightedPlayer
	} from './dashboard-utils';
	import { formatMatchupGap, getMatchupStats } from './lobby-scout';
	import { useI18n } from '$lib/i18n';

	type Props = {
		lobby: Match;
	};

	type SmurfMap = Record<number, SmurfAlertState>;

	let { lobby }: Props = $props();
	const { t } = useI18n();

	const allies = $derived(getAlliesPlayers(lobby.players));
	const axis = $derived(getAxisPlayers(lobby.players));
	const startedAt = $derived(lobby.startedAt?.split(':').slice(0, 2).join(':') ?? '—');
	const humanPlayers = $derived(lobby.players.filter((player) => player.playerId !== -1).length);
	const mapLabel = $derived(normalizeMapName(lobby.map));
	const matchType = $derived(lobby.matchType);
	const highlightPlayerId = $derived(
		lobby.me ? (getPlayerProfileId(lobby.me) ?? lobby.me.playerId) : undefined
	);
	const ratingsKey = $derived(
		lobby.isReplay
			? ''
			: lobby.players
					.map((player) => player.steamId)
					.filter(isValidSteamId)
					.join(',')
	);
	const ratings = resource(
		() => ratingsKey,
		(key) => getPlayerRatings(key ? key.split(',') : [])
	);
	const players = $derived.by((): LobbyPlayer[] => {
		const source = lobby.players;
		const stored = ratings.current;
		if (!stored) return source;

		return source.map((player) => {
			if (!player.steamId) return player;
			const record = stored.get(player.steamId);
			return record ? { ...player, storedElo: record.elo } : player;
		});
	});
	const humans = $derived(players.filter((player) => player.playerId !== -1));
	const smurfKey = $derived(
		lobby.isReplay
			? ''
			: humans
					.map((player) => {
						const profileId = getPlayerProfileId(player) ?? 0;
						return `${profileId}:${player.steamId ?? ''}`;
					})
					.join('|')
	);

	async function loadSmurfs(source: LobbyPlayer[]): Promise<SmurfMap> {
		const next: SmurfMap = {};
		if (source.length === 0) return next;

		await Promise.all(
			source.map(async (player) => {
				const profileId = getPlayerProfileId(player);
				const steamId = player.steamId;
				if (!steamId || !isValidSteamId(steamId)) return;
				const smurf = await loadSmurfAlert(steamId, profileId, 'lobby_match');
				if (profileId != null && smurf) {
					next[profileId] = smurf;
				}
			})
		);

		return next;
	}

	const smurfAlerts = resource(
		() => smurfKey,
		() => loadSmurfs(humans)
	);
	const smurfs = $derived(smurfAlerts.current);
	const cheaters = resource(
		() => ratingsKey,
		(key) => loadCheaterSteamIds(key ? key.split(',') : [])
	);
	const playbackReplay = resource(
		() => {
			if (!lobby.isReplay || !lobby.map || lobby.players.length === 0) {
				return null;
			}

			return {
				map: lobby.map,
				races: lobby.players.map((player) => player.race).join(',')
			};
		},
		async (key) => {
			if (!key) {
				return null;
			}

			return app.features.history.findPlaybackReplay({
				map: key.map,
				players: key.races.split(',').map((race) => ({ race: Number(race) }))
			});
		}
	);

	const matchup = $derived(
		getMatchupStats(getAlliesPlayers(players), getAxisPlayers(players), lobby.matchType)
	);
	const highest = $derived.by(() => {
		const alliesMax = matchup.allies.max;
		const axisMax = matchup.axis.max;
		if (alliesMax == null && axisMax == null) return { value: null, alias: null };
		if (alliesMax == null) return { value: axisMax, alias: matchup.axis.maxAlias };
		if (axisMax == null) return { value: alliesMax, alias: matchup.allies.maxAlias };
		if (axisMax > alliesMax) return { value: axisMax, alias: matchup.axis.maxAlias };
		return { value: alliesMax, alias: matchup.allies.maxAlias };
	});

	const overviewMatch = $derived.by((): CommunityMatchDetail => {
		const communityPlayers: CommunityPlayer[] = players.map((player) => {
			const profileId = getPlayerProfileId(player) ?? 0;
			return {
				playerId: player.playerId ?? null,
				steamId: player.steamId ?? null,
				race: player.race ?? null,
				profile: {
					profile_id: profileId,
					alias: getPlayerAlias(player)
				}
			};
		});

		return {
			id: String(lobby.sessionId ?? ''),
			map: lobby.map ?? '',
			isRanked: !!lobby.isRanked,
			createdAt: lobby.startedAt ?? '',
			durationSeconds: null,
			likeCount: 0,
			downloadCount: 0,
			players: communityPlayers,
			result: null
		};
	});

	const livePlayers = $derived.by((): LiveLobbyPlayer[] => {
		if (lobby.isReplay) {
			return players.map((player, index) => {
				const profileId = getPlayerProfileId(player) ?? null;
				const isCpu = player.playerId === -1;
				return {
					index: player.index ?? index,
					playerId: player.playerId,
					type: player.type,
					race: player.race,
					team: player.team,
					alias: getPlayerAlias(player),
					profileId: !isCpu && profileId != null && profileId > 0 ? profileId : null,
					steamId: isCpu ? null : (player.steamId ?? null),
					country: isCpu ? null : player.profile?.country || null,
					stats: null
				};
			});
		}

		return players.map((player, index) => {
			const profileId = getPlayerProfileId(player) ?? null;
			const isCpu = player.playerId === -1;
			const statsRow = isCpu
				? null
				: getLeaderboardStatsForPlayerByMatchType(matchType, player);
			const elo = isCpu
				? null
				: (getPlayerEloFromMatchHistory(matchType, player) ??
					getStoredEloRating(player.storedElo, matchType, player.race) ??
					null);
			const country = isCpu ? null : player.profile?.country || null;

			return {
				index: player.index ?? index,
				playerId: player.playerId,
				type: player.type,
				race: player.race,
				team: player.team,
				alias: getPlayerAlias(player),
				profileId: !isCpu && profileId != null && profileId > 0 ? profileId : null,
				steamId: isCpu ? null : (player.steamId ?? null),
				country,
				stats:
					!isCpu && (statsRow || elo != null)
						? {
								elo,
								wins: statsRow?.wins ?? 0,
								losses: statsRow?.losses ?? 0,
								streak: statsRow?.streak ?? 0,
								rank: statsRow?.rank ?? 0,
								rankLevel: statsRow?.ranklevel ?? 0
							}
						: null
			};
		});
	});

	const overviewReplay = $derived.by((): ReplayData | null => {
		const parsed = playbackReplay.current;
		if (!parsed) {
			return null;
		}

		return {
			playerCount: parsed.playerCount,
			duration: parsed.duration,
			players: parsed.players.map((player) => ({
				id: player.id ?? null,
				name: player.name,
				faction: player.faction,
				doctrineName: player.doctrineName,
				steamId: player.steamId ?? null,
				doctrine: player.doctrine
			})),
			messages: parsed.messages,
			actions: parsed.actions,
			cpmByPlayerId: parsed.cpmByPlayerId
		} as ReplayData;
	});

	function resolveFactionFlag(raceId: number): string {
		return getFactionFlagFromRace(raceId);
	}

	function flagImageUrl(country: string | null | undefined): string | null {
		if (!country) return null;
		const region = String(country).trim().toUpperCase();
		if (!/^[A-Z]{2}$/.test(region)) return null;
		return `https://flagsapi.com/${region}/shiny/64.png`;
	}

	function playerHref(player: CommunityPlayer): string | null {
		if (player.playerId === -1) {
			return null;
		}

		const id = player.profile.profile_id;
		return id > 0 ? `/players/${id}` : null;
	}

	function livePlayerHref(player: LiveLobbyPlayer): string | null {
		if (player.playerId === -1) {
			return null;
		}

		return player.profileId != null && player.profileId > 0
			? `/players/${player.profileId}`
			: null;
	}

	function isHighlightedName(name: string): boolean {
		const key = name.trim().toLowerCase();
		const player = players.find((entry) => getPlayerAlias(entry).trim().toLowerCase() === key);
		return player ? isHighlightedPlayer(player, highlightPlayerId) : false;
	}

	function playerCpm(data: ReplayData, playerId: number | null): string {
		if (playerId == null) {
			return '0';
		}

		const precomputed = (data as ReplayData & { cpmByPlayerId?: Record<string, string> })
			.cpmByPlayerId?.[String(playerId)];
		if (precomputed != null) {
			return precomputed;
		}

		const parsed = playbackReplay.current;
		if (!parsed) {
			return '0';
		}

		return parsed.cpmByPlayerId[String(playerId)] ?? '0';
	}
</script>

{#snippet eloValue(value: number | null, alias?: string | null)}
	{#if value == null}
		<span class="text-secondary-400">—</span>
	{:else}
		<span
			class="tabular-nums"
			style:color={getEloColor(value)}
			style:text-shadow={getEloTextShadow(value)}
			title={alias ?? undefined}
		>
			{value}{#if alias}
				<span class="text-secondary-400 font-normal"> · {alias}</span>
			{/if}
		</span>
	{/if}
{/snippet}

{#snippet nameExtra(args: { name: string; steamId: string | null; profileId: number | null })}
	{@const lobbyPlayer = players.find((player) => {
		if (args.profileId != null && getPlayerProfileId(player) === args.profileId) return true;
		if (args.steamId && player.steamId === args.steamId) return true;
		return getPlayerAlias(player).trim().toLowerCase() === args.name.trim().toLowerCase();
	})}
	{#if lobbyPlayer}
		{@const smurf = args.profileId != null && smurfs ? smurfs[args.profileId] : undefined}
		<PlayerUi.Root player={lobbyPlayer} race={lobbyPlayer.race}>
			<PlayerUi.Labels steamId={lobbyPlayer.steamId} class="shrink-0" />
			{#if smurf?.status === 'shared'}
				<PlayerUi.SmurfAlert {smurf} compact />
			{/if}
			{#if lobbyPlayer.steamId && cheaters.current?.has(lobbyPlayer.steamId)}
				<PlayerUi.CheaterAlert compact />
			{/if}
		</PlayerUi.Root>
	{/if}
{/snippet}

<SetCrumbs items={[{ label: mapLabel }]} />

<div class="border-secondary-900 overflow-clip border-b">
	<div
		class="border-secondary-800 grid grid-cols-1 border-b sm:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]"
	>
		<div class="border-secondary-800 aspect-square self-start sm:border-r">
			<MapImage map={lobby.map} alt={mapLabel} flush />
		</div>

		<div class="min-w-0 px-6 py-4">
			<div class="mb-3 flex min-w-0 items-center gap-3">
				<span class="font-heading min-w-0 truncate text-3xl font-bold">{mapLabel}</span>
				{#if !lobby.isReplay}
					<LiveBadge label={t('Live')} />
				{/if}
			</div>

			<div class={detailMetaGrid}>
				<List.Title>{t('Session')}</List.Title>
				<List.Value class="tabular-nums">{lobby.sessionId}</List.Value>
				<List.Title>{t('Match type')}</List.Title>
				<List.Value>
					{lobby.isReplay ? t('Replay') : lobby.isSkirmish ? t('Skirmish') : lobby.isRanked ? t('Ranked') : t('Custom')}
				</List.Value>

				<List.Title>{t('Game mode')}</List.Title>
				<List.Value>{lobby.type}</List.Value>
				<List.Title>{t('Players')}</List.Title>
				<List.Value>{humanPlayers} / {lobby.players.length}</List.Value>

				<List.Title>{t('Started')}</List.Title>
				<List.Value class="tabular-nums">{startedAt}</List.Value>
				<List.Title>{t('Teams')}</List.Title>
				<List.Value
					>{t('{allies} vs {axis}', { allies: allies.length, axis: axis.length })}</List.Value
				>

				{#if humanPlayers > 0 && !lobby.isReplay}
					<List.Title>{t('Allies ELO')}</List.Title>
					<List.Value>
						{@render eloValue(matchup.allies.avg)}
					</List.Value>
					<List.Title>{t('Axis ELO')}</List.Title>
					<List.Value>
						{@render eloValue(matchup.axis.avg)}
					</List.Value>
					<List.Title>{t('Gap')}</List.Title>
					<List.Value class="tabular-nums">{formatMatchupGap(matchup.gap)}</List.Value>
					<List.Title>{t('Highest')}</List.Title>
					<List.Value class="min-w-0 truncate">
						{@render eloValue(highest.value, highest.alias)}
					</List.Value>
				{/if}
			</div>
		</div>
	</div>

	<div class="border-secondary-800 border-b">
		<Overview
			match={overviewMatch}
			replay={overviewReplay}
			{livePlayers}
			{playerHref}
			{flagImageUrl}
			{getCountryDisplayName}
			{resolveFactionFlag}
			{raceFromReplayFaction}
			{doctrineBannerUrl}
			{playerCpm}
			formatStreakLabel={formatStreak}
			getRankImage={lobby.isReplay ? undefined : getRankImage}
			levelLabel={t('Lv')}
			alliesLabel={t('Allies')}
			axisLabel={t('Axis')}
			unknownDoctrineLabel={t('Unknown doctrine')}
			ratingLabel={t('Rating')}
			cpmLabel={t('CPM')}
			{livePlayerHref}
			{isHighlightedName}
			{nameExtra}
		/>
	</div>
</div>
