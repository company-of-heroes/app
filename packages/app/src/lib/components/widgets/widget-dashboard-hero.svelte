<script lang="ts">
	import { app } from '$core/app/context';
	import { Alert } from '$lib/components/ui/alert';
	import { Leaderboard } from '../leaderboard';
	import LeaderboardStatPill from '$lib/components/leaderboard/leaderboard-stat-pill.svelte';
	import { MatchHistory } from '../match-history';
	import { PlayerPerformance } from '$lib/components/player-performance';
	import { relic, relicLeaderboardFingerprint } from '$lib/relic';
	import { steam } from '$core/steam';
	import { cn, getFactionFlagFromRace, getRankImageByLeaderboardId, normalizeMapName } from '$lib/utils';
	import { getFactionFlagFromLeaderboardId } from '$lib/utils/game';
	import { interactive, statLosses, statWins } from '$lib/components/ui/variants';
	import * as Tabs from '$lib/components/ui/tabs';
	import { resource, watch } from 'runed';
	import { onDestroy, onMount } from 'svelte';
	import type { UnsubscribeFunc } from 'pocketbase';
	import { fetch } from '$core/http/fetch';
	import { exp } from '$core/pocketbase';
	import type { Match as LobbyMatch, MatchExpanded } from '$core/app/database/matches';
	import { upperCase } from 'lodash-es';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import * as Player from '$lib/components/player';
	import { PlayerProfileLink, playerPreviewId } from '@company-of-heroes/ui/player';
	import * as List from '$lib/components/ui/list';
	import { Badge, LiveBadge, PendingBadge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		collectTodayMatchSteamIds,
		countTodayRecord,
		isMatchFromLocalToday,
		matchIncludesSteamIds,
		todayPlayedMatchesFilter
	} from './dashboard-utils';
	import { getPlayerRating } from '$core/pocketbase/player-ratings';
	import { eloMapForSteamId, mergeEloMaps } from '$lib/utils/player-elo';
	import { useI18n } from '$lib/i18n';
	import {
		emptyPlayerPerformance,
		getPlayerPerformance,
		invalidatePlayerPerformanceCache,
		type PerformanceRecentMatch
	} from '$core/pocketbase/player-performance';
	import { MATCH_TYPES } from '$core/game/lobby';
	import {
		buildRankedModeRows,
		getEloColor,
		getEloTextShadow,
		getRaceLabel,
		getRaceLabelFromLeaderboardId,
		getRatioColor,
		isEliteElo,
		pickBestMap,
		pickFeaturedMode,
		pickMainFaction
	} from '$lib/components/leaderboard/leaderboard-utils';
	import { tooltip } from '$lib/attachments';
	import { resolve } from '$app/paths';

	const PROFILE_POLL_MS = 90_000;

	let activeTab = $state('stats');
	let panelExpanded = $state(false);
	let statsGeneration = $state(0);
	let unsubscribeToday = $state<UnsubscribeFunc>();
	let subscribeGeneration = 0;
	let bumpTimer: ReturnType<typeof setTimeout> | null = null;
	let profilePollTimer: ReturnType<typeof setInterval> | null = null;
	const { t } = useI18n();

	const steamId = $derived(
		app.game.profile?.steam.steamid ?? app.features.auth.user.steamIds[0] ?? null
	);

	const resolvedProfile = resource(
		() => [app.game.profile ?? null, steamId] as const,
		async ([live, id]) => {
			if (live) {
				return live;
			}

			if (!id) {
				return null;
			}

			const [relicProfile, steamProfile] = await Promise.all([
				relic.getProfileBySteamId(id),
				steam.getUserProfile(id)
			]);
			if (!relicProfile || !steamProfile) {
				return null;
			}

			return { relic: relicProfile, steam: steamProfile };
		}
	);

	const profile = $derived(app.game.profile ?? resolvedProfile.current ?? null);
	const profileId = $derived(profile?.relic.profile_id ?? null);
	const todaySteamIds = $derived(collectTodayMatchSteamIds(app.features.auth.user.steamIds));

	function bumpStats() {
		invalidatePlayerPerformanceCache(profileId ?? undefined);
		if (bumpTimer) {
			clearTimeout(bumpTimer);
		}

		bumpTimer = setTimeout(() => {
			bumpTimer = null;
			statsGeneration += 1;
		}, 300);
	}

	async function refreshRelicLeaderboards() {
		const id = steamId;
		if (!id) {
			return;
		}

		try {
			const relicProfile = await relic.getProfileBySteamId(id);
			if (!relicProfile) {
				return;
			}

			const live = app.game.profile;
			if (live) {
				const previous = relicLeaderboardFingerprint(live.relic.leaderboardStats);
				const next = relicLeaderboardFingerprint(relicProfile.leaderboardStats);
				if (previous === next) {
					return;
				}

				app.game.profile = { relic: relicProfile, steam: live.steam };
				return;
			}

			const current = resolvedProfile.current;
			if (!current) {
				return;
			}

			const previous = relicLeaderboardFingerprint(current.relic.leaderboardStats);
			const next = relicLeaderboardFingerprint(relicProfile.leaderboardStats);
			if (previous === next) {
				return;
			}

			resolvedProfile.mutate({ relic: relicProfile, steam: current.steam });
		} catch (error) {
			console.warn('[DASHBOARD]: relic profile refresh failed:', error);
		}
	}

	const offLobbySaved = app.on('lobby.saved', bumpStats);
	const offMatchResult = app.on('match.result', bumpStats);
	const offLobbyDestroyed = app.on('lobby.destroyed', bumpStats);

	const todayMatches = resource(
		() => [todaySteamIds.join(','), statsGeneration] as const,
		async ([steamIdsKey]) => {
			const ids = steamIdsKey ? steamIdsKey.split(',').filter(Boolean) : [];
			if (ids.length === 0) {
				return [];
			}

			const items = await app.database.matches.getList({
				filter: todayPlayedMatchesFilter(ids),
				sort: '-createdAt'
			});
			return items.filter(
				(match) => isMatchFromLocalToday(match) && matchIncludesSteamIds(match, ids)
			);
		}
	);

	const recentMatches = resource(
		() => [profileId, statsGeneration] as const,
		async ([id]) => (id ? relic.getRecentMatchHistoryForProfile(id) : []),
		{ initialValue: [] }
	);

	const todayRecord = $derived(
		countTodayRecord(todayMatches.current ?? [], profileId ?? undefined, todaySteamIds)
	);

	const storedRating = resource(
		() => [steamId, statsGeneration] as const,
		async ([id]) => (id ? getPlayerRating(id) : null)
	);
	const playerElo = $derived(
		mergeEloMaps(
			storedRating.current?.elo,
			steamId ? eloMapForSteamId(recentMatches.current, steamId) : undefined
		)
	);

	const trackedPerformance = resource(
		() => [profileId, app.features.auth.userId, statsGeneration] as const,
		async ([id, userId]) => {
			if (!id || !userId) {
				return emptyPlayerPerformance();
			}

			return getPlayerPerformance({
				profileId: id,
				scope: 'user',
				userId,
				fresh: true
			});
		},
		{ initialValue: emptyPlayerPerformance() }
	);
	const tracked = $derived(trackedPerformance.current ?? emptyPlayerPerformance());
	const formMatches = $derived((tracked.recentMatches ?? []).slice(0, 10));
	const bestMap = $derived(pickBestMap(tracked.byMap ?? []));
	const mainFaction = $derived(pickMainFaction(tracked.byFaction ?? []));

	const modeRows = $derived(buildRankedModeRows(profile?.relic.leaderboardStats ?? [], playerElo));
	const featuredMode = $derived(pickFeaturedMode(modeRows));

	watch(
		() => relicLeaderboardFingerprint(profile?.relic.leaderboardStats),
		(next, previous) => {
			if (previous && next !== previous) {
				bumpStats();
			}
		}
	);

	watch(
		() => todaySteamIds.join(','),
		(steamIdsKey) => {
			const ids = steamIdsKey ? steamIdsKey.split(',').filter(Boolean) : [];
			const generation = ++subscribeGeneration;
			void (async () => {
				await unsubscribeToday?.();
				if (generation !== subscribeGeneration) {
					return;
				}

				unsubscribeToday = undefined;
				if (ids.length === 0) {
					return;
				}

				const next = await app.pocketbase.collection('lobbies').subscribe<LobbyMatch>(
					'*',
					(e) => {
						const match = exp(e.record) as MatchExpanded;
						if (!isMatchFromLocalToday(match) || !matchIncludesSteamIds(match, ids)) {
							return;
						}

						if (e.action === 'create') {
							const current = todayMatches.current || [];
							if (!current.find((entry) => entry.id === e.record.id)) {
								todayMatches.mutate([...current, match]);
							}
						} else if (e.action === 'update') {
							todayMatches.mutate(
								(todayMatches.current || []).map((entry) =>
									entry.id === e.record.id ? match : entry
								)
							);
							if (!match.needsResult) {
								bumpStats();
							}
						} else if (e.action === 'delete') {
							todayMatches.mutate(
								(todayMatches.current || []).filter((entry) => entry.id !== e.record.id)
							);
						}
					},
					{
						filter: todayPlayedMatchesFilter(ids),
						sort: '-createdAt',
						fetch
					}
				);

				if (generation !== subscribeGeneration) {
					await next();
					return;
				}

				unsubscribeToday = next;
			})();
		}
	);

	onMount(() => {
		void refreshRelicLeaderboards();
		profilePollTimer = setInterval(() => void refreshRelicLeaderboards(), PROFILE_POLL_MS);
	});

	onDestroy(() => {
		subscribeGeneration += 1;
		if (bumpTimer) {
			clearTimeout(bumpTimer);
		}

		if (profilePollTimer) {
			clearInterval(profilePollTimer);
			profilePollTimer = null;
		}

		unsubscribeToday?.();
		offLobbySaved();
		offMatchResult();
		offLobbyDestroyed();
	});

	const metaList = 'grid-cols-[7.5rem_minmax(0,1fr)] content-start gap-x-4';
	const valueRow = 'inline-flex min-w-0 flex-nowrap items-center gap-2 whitespace-nowrap';
	const recentMatchBase =
		'min-w-6 px-1.5 py-0.5 text-center font-semibold transition-colors duration-150';
	const recentMatchWin =
		'border-success/15 bg-success/5 text-success/45 group-hover:border-success/50 group-hover:bg-success/25 group-hover:text-green-300 group-focus-visible:border-success/50 group-focus-visible:bg-success/25 group-focus-visible:text-green-300';
	const recentMatchLoss =
		'border-destructive/15 bg-destructive/5 text-destructive/45 group-hover:border-destructive/50 group-hover:bg-destructive/25 group-hover:text-red-300 group-focus-visible:border-destructive/50 group-focus-visible:bg-destructive/25 group-focus-visible:text-red-300';

	const avatarBorder = $derived(app.lobby ? 'border-green-500' : 'border-secondary-800');
	const profileHref = $derived(
		profileId != null
			? resolve('/(loaded)/players/[id]', { id: String(profileId) })
			: null
	);
	const previewId = $derived(
		profile
			? (playerPreviewId({
					steamId: profile.steam.steamid,
					profileId: profile.relic.profile_id
				}) ?? String(profile.relic.profile_id))
			: null
	);

	function openTab(tab: string) {
		activeTab = tab;
		panelExpanded = true;
	}

	function modeLabel(matchtypeId: number): string {
		return (
			MATCH_TYPES[matchtypeId as keyof typeof MATCH_TYPES] ?? t('Mode {id}', { id: matchtypeId })
		);
	}

	function recentMatchLabel(match: PerformanceRecentMatch): string {
		const faction = match.raceId != null ? getRaceLabel(match.raceId) : t('Unknown');
		const mode = match.matchtypeId != null ? modeLabel(match.matchtypeId) : t('Unknown');
		return `${faction} · ${mode}`;
	}

	function recentMatchTooltip(match: PerformanceRecentMatch): string {
		const mode = match.matchtypeId != null ? modeLabel(match.matchtypeId) : t('Unknown');
		if (match.raceId == null) {
			return mode;
		}

		return `<span class="inline-flex items-center gap-1.5 leading-none"><span class="inline-flex p-[3px]"><img src="${getFactionFlagFromRace(match.raceId)}" alt="" class="ring-secondary-800 size-5 shrink-0 rounded-full object-cover ring-4" /></span>${mode}</span>`;
	}

	function winratePercent(wins: number, losses: number): string {
		const total = wins + losses;
		if (total === 0) {
			return '—';
		}

		return `${Math.round((wins / total) * 100)}%`;
	}
</script>

{#if profile}
	{#key profile.relic.profile_id}
		<div class="border-secondary-900 overflow-clip border-b">
			<div
				class={cn(
					'border-secondary-800 grid grid-cols-1 border-b',
					'sm:grid-cols-[minmax(200px,240px)_minmax(0,1fr)]'
				)}
			>
				{#if profileHref && previewId}
					<PlayerProfileLink
						href={profileHref}
						playerId={previewId}
						class={cn(
							interactive,
							'aspect-square self-start overflow-clip border-b sm:border-r sm:border-b-0',
							avatarBorder
						)}
					>
						<img
							src={profile.steam.avatarfull}
							alt={profile.relic.alias}
							class="h-full w-full object-cover"
						/>
					</PlayerProfileLink>
				{/if}

				<div class="min-w-0 px-5 py-4">
					<div class="mb-3 flex flex-wrap items-center gap-2.5">
						{#if profileHref && previewId}
							<PlayerProfileLink
								href={profileHref}
								playerId={previewId}
								class={cn(
									interactive,
									'hover:text-primary flex min-w-0 items-center gap-2.5 transition-colors'
								)}
							>
							{#if profile.relic.country}
								<img
									class="h-5 w-auto shrink-0 rounded-xs"
									src="https://flagsapi.com/{upperCase(profile.relic.country)}/shiny/64.png"
									alt={profile.relic.country}
								/>
							{/if}
								<Player.LikeCount steamId={profile.steam.steamid} class="shrink-0" />
								<span class="font-heading truncate text-3xl font-bold">{profile.relic.alias}</span>
							</PlayerProfileLink>
						{/if}
						<Player.Labels steamId={profile.steam.steamid} class="shrink-0" />
						{#if app.lobby}
							<a href={resolve('/(loaded)/current-game')} class={cn(interactive, 'shrink-0')}>
								<LiveBadge label={t('In match')} />
							</a>
						{:else if !app.game.isRunning}
							<Badge variant="default" class="shrink-0">{t('Not running')}</Badge>
						{/if}
					</div>

					<div class="grid grid-cols-1 items-start gap-x-6 gap-y-1 sm:grid-cols-2">
						<List.Root class={metaList}>
							<List.Title>{t('Ladder:')}</List.Title>
							<List.Value class={valueRow}>
								{#if featuredMode}
									<span class="text-secondary-400 text-xs font-medium uppercase">
										{featuredMode.label}
									</span>
									<img
										src={getFactionFlagFromLeaderboardId(featuredMode.stat.leaderboard_id)}
										alt={getRaceLabelFromLeaderboardId(featuredMode.stat.leaderboard_id)}
										class="size-4 shrink-0 rounded-full object-cover ring-1 ring-black/40"
									/>
									{#if featuredMode.rating == null}
										<span class="text-secondary-500">{t('N/A')}</span>
									{:else}
										<span
											class={cn(
												'font-heading text-lg tabular-nums',
												isEliteElo(featuredMode.rating) ? 'font-bold' : 'font-semibold'
											)}
											style:color={getEloColor(featuredMode.rating)}
											style:text-shadow={getEloTextShadow(featuredMode.rating)}
										>
											{featuredMode.rating}
										</span>
									{/if}
									{#if featuredMode.stat.ranklevel > 0}
										<img
											src={getRankImageByLeaderboardId(
												featuredMode.stat.leaderboard_id,
												featuredMode.stat.ranklevel
											)}
											alt={t('Rank {level}', { level: featuredMode.stat.ranklevel })}
											class="h-6 w-auto shrink-0"
										/>
										<span class="text-secondary-200 text-sm font-medium tabular-nums">
											{featuredMode.stat.ranklevel}
										</span>
									{/if}
									{#if featuredMode.stat.rank > 0}
										<span class="text-secondary-500 text-xs tabular-nums">
											{t('#{rank} / {total}', {
												rank: featuredMode.stat.rank,
												total: featuredMode.stat.ranktotal
											})}
										</span>
									{/if}
								{:else}
									<span class="text-secondary-400 text-sm">
										{t('Play ranked to unlock your ladder spotlight.')}
									</span>
								{/if}
							</List.Value>

							<List.Title>{t('Today:')}</List.Title>
							<List.Value class={valueRow}>
								{#if todayRecord.wins + todayRecord.losses > 0}
									<span class={statWins}>{t('{count}W', { count: todayRecord.wins })}</span>
									<span class="text-secondary-600">·</span>
									<span class={statLosses}>{t('{count}L', { count: todayRecord.losses })}</span>
									{#if todayRecord.pending > 0}
										<PendingBadge label={t('{count} pending', { count: todayRecord.pending })} />
									{/if}
								{:else if todayRecord.pending > 0}
									<PendingBadge label={t('{count} pending', { count: todayRecord.pending })} />
									<span class="text-secondary-400 text-sm">{t('Result pending')}</span>
								{:else}
									<span class={statWins}>{t('{count}W', { count: 0 })}</span>
									<span class="text-secondary-600">·</span>
									<span class={statLosses}>{t('{count}L', { count: 0 })}</span>
								{/if}
							</List.Value>

							<List.Title>{t('Career:')}</List.Title>
							<List.Value class={valueRow}>
								{#if tracked.matchCount > 0}
									<span class={statWins}>{t('{count}W', { count: tracked.wins })}</span>
									<span class="text-secondary-600">·</span>
									<span class={statLosses}>{t('{count}L', { count: tracked.losses })}</span>
									<LeaderboardStatPill
										type="ratio"
										wins={tracked.wins}
										losses={tracked.losses}
										streak={0}
									/>
								{:else}
									<span class="text-secondary-400 text-sm">
										{t('Play with the companion running to build stats.')}
									</span>
								{/if}
							</List.Value>
						</List.Root>

						<List.Root class={metaList}>
							{#if featuredMode && featuredMode.stat.streak !== 0}
								<List.Title>{t('Streak:')}</List.Title>
								<List.Value class={valueRow}>
									<LeaderboardStatPill
										type="streak"
										wins={featuredMode.stat.wins}
										losses={featuredMode.stat.losses}
										streak={featuredMode.stat.streak}
									/>
								</List.Value>
							{/if}

							{#if featuredMode && featuredMode.stat.highestranklevel > 0}
								<List.Title>{t('Peak:')}</List.Title>
								<List.Value class={valueRow}>
									<img
										src={getRankImageByLeaderboardId(
											featuredMode.stat.leaderboard_id,
											featuredMode.stat.highestranklevel
										)}
										alt={t('Rank {level}', { level: featuredMode.stat.highestranklevel })}
										class="h-6 w-auto shrink-0"
									/>
									<span class="text-secondary-200 text-sm font-medium tabular-nums">
										{featuredMode.stat.highestranklevel}
									</span>
									{#if featuredMode.stat.highestrank > 0}
										<span class="text-secondary-500 text-xs tabular-nums">
											{t('#{rank}', { rank: featuredMode.stat.highestrank })}
										</span>
									{/if}
								</List.Value>
							{/if}

							{#if bestMap}
								<List.Title>{t('Best map:')}</List.Title>
								<List.Value class={valueRow}>
									<span class="text-secondary-300 max-w-44 truncate">
										{normalizeMapName(bestMap.map, false)}
									</span>
									<span class={statWins}>{t('{count}W', { count: bestMap.wins })}</span>
									<span class="text-secondary-600">·</span>
									<span class={statLosses}>{t('{count}L', { count: bestMap.losses })}</span>
									<span
										class="font-medium"
										style:color={getRatioColor(bestMap.wins, bestMap.losses)}
									>
										{winratePercent(bestMap.wins, bestMap.losses)}
									</span>
								</List.Value>
							{/if}

							{#if mainFaction}
								<List.Title>{t('Main faction:')}</List.Title>
								<List.Value class={valueRow}>
									<img
										src={getFactionFlagFromRace(mainFaction.raceId)}
										alt={getRaceLabel(mainFaction.raceId)}
										class="size-4 shrink-0 rounded-full object-cover ring-1 ring-black/40"
									/>
									<span class="text-secondary-300">{getRaceLabel(mainFaction.raceId)}</span>
									<span class={statWins}>{t('{count}W', { count: mainFaction.wins })}</span>
									<span class="text-secondary-600">·</span>
									<span class={statLosses}>{t('{count}L', { count: mainFaction.losses })}</span>
								</List.Value>
							{/if}

							{#if formMatches.length > 0}
								<List.Title>{t('Recent:')}</List.Title>
								<List.Value
									class="inline-flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto"
								>
									{#each formMatches as match (match.id || match.sessionId)}
										<a
											href={resolve('/(loaded)/history/[id]', { id: match.id })}
											class={cn(interactive, 'group inline-flex shrink-0')}
											aria-label="{match.outcome === 1
												? t('Win')
												: t('Loss')} — {recentMatchLabel(match)}"
											{@attach tooltip(recentMatchTooltip(match))}
										>
											<Badge
												variant={match.outcome === 1 ? 'success' : 'destructive'}
												class={cn(
													recentMatchBase,
													match.outcome === 1 ? recentMatchWin : recentMatchLoss
												)}
											>
												{match.outcome === 1 ? t('W') : t('L')}
											</Badge>
										</a>
									{/each}
								</List.Value>
							{/if}
						</List.Root>
					</div>
				</div>
			</div>

			<div>
				<Tabs.Root bind:value={activeTab}>
					<div class="flex items-center justify-between px-4 py-2.5">
						<Tabs.List
							class={cn(
								!panelExpanded &&
									'[&_[data-state=active]]:border-transparent [&_[data-state=active]]:bg-transparent [&_[data-state=active]]:text-white'
							)}
						>
							<Tabs.Trigger value="stats" onclick={() => openTab('stats')}>{t('Stats')}</Tabs.Trigger>
							<Tabs.Trigger value="performance" onclick={() => openTab('performance')}>
								{t('Performance')}
							</Tabs.Trigger>
							<Tabs.Trigger value="recent-games" onclick={() => openTab('recent-games')}>
								{t('Recent games')}
							</Tabs.Trigger>
						</Tabs.List>
						<button
							type="button"
							class={cn(interactive, 'text-secondary-400 hover:text-primary p-1 transition-colors')}
							aria-expanded={panelExpanded}
							aria-label={panelExpanded ? t('Collapse panel') : t('Expand panel')}
							onclick={() => (panelExpanded = !panelExpanded)}
						>
							<CaretDownIcon
								class={cn('size-4 transition-transform', panelExpanded && 'rotate-180')}
							/>
						</button>
					</div>
					{#if panelExpanded}
						<div class="border-secondary-800 border-t">
							<Tabs.Content value="stats">
								<Leaderboard
									stats={profile.relic.leaderboardStats ?? []}
									elo={playerElo}
									class="rounded-none border-0"
								/>
							</Tabs.Content>
							<Tabs.Content value="performance">
								<PlayerPerformance
									profileId={profile.relic.profile_id}
									scope="user"
									userId={app.features.auth.userId}
									refreshKey={statsGeneration}
									empty="self"
									class="rounded-none border-0"
								/>
							</Tabs.Content>
							<Tabs.Content value="recent-games">
								{#if recentMatches.loading}
									<div class="divide-secondary-800 border-secondary-800 divide-y border-t">
										{#each Array(5) as _, index (index)}
											<div class="px-4 py-3">
												<Skeleton class="h-4 w-full" />
											</div>
										{/each}
									</div>
								{:else}
									<MatchHistory matches={recentMatches.current ?? []} showSessionId />
								{/if}
							</Tabs.Content>
						</div>
					{/if}
				</Tabs.Root>
			</div>
		</div>
	{/key}
{:else if resolvedProfile.loading}
	<Player.ProfileSkeleton widget />
{:else}
	<Alert variant="warning">
		{t('Company of Heroes is not running. Start the game to see your profile and match tracking.')}
	</Alert>
{/if}
