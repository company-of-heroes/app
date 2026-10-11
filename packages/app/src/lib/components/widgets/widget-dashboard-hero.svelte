<script lang="ts">
	import { isStreamingLink } from '@company-of-heroes/api';
	import { api } from '$core/api';
	import { app } from '$core/app/context';
	import { Alert } from '$lib/components/ui/alert';
	import { PlayerStatsTable } from '@company-of-heroes/ui/player';
	import { LeaderboardStatPill } from '@company-of-heroes/ui/leaderboard';
	import { MatchHistory } from '../match-history';
	import { PlayerPerformance } from '$lib/components/player-performance';
	import { relic, relicLeaderboardFingerprint } from '$lib/relic';
	import { steam } from '$core/steam';
	import {
		cn,
		getFactionFlagFromRace,
		getRankImageByLeaderboardId,
		normalizeMapName
	} from '$lib/utils';
	import { getFactionFlagFromLeaderboardId } from '$lib/utils/game';
	import { interactive, statLosses, statWins, factionIcon } from '$lib/components/ui/variants';
	import * as Tabs from '$lib/components/ui/tabs';
	import { resource, watch } from 'runed';
	import { onDestroy, onMount } from 'svelte';
	import type { UnsubscribeFunc } from 'pocketbase';
	import { fetch } from '$core/http/fetch';
	import { exp } from '$core/pocketbase';
	import type { Match as LobbyMatch, MatchExpanded } from '$core/app/database/matches';
	import { upperCase } from 'lodash-es';
	import CalendarCheckIcon from 'phosphor-svelte/lib/CalendarCheckIcon';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import CheckIcon from 'phosphor-svelte/lib/CheckIcon';
	import ClockCounterClockwiseIcon from 'phosphor-svelte/lib/ClockCounterClockwiseIcon';
	import FlagIcon from 'phosphor-svelte/lib/FlagIcon';
	import FlameIcon from 'phosphor-svelte/lib/FlameIcon';
	import MapTrifoldIcon from 'phosphor-svelte/lib/MapTrifoldIcon';
	import MountainsIcon from 'phosphor-svelte/lib/MountainsIcon';
	import PencilSimpleIcon from 'phosphor-svelte/lib/PencilSimpleIcon';
	import RankingIcon from 'phosphor-svelte/lib/RankingIcon';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import UserIcon from 'phosphor-svelte/lib/UserIcon';
	import UserSwitchIcon from 'phosphor-svelte/lib/UserSwitchIcon';
	import * as Dropdown from '$lib/components/ui/dropdown';
	import { dropdownItemIcon } from '@company-of-heroes/ui/variants';
	import * as Player from '$lib/components/player';
	import {
		PlayerFact,
		PlayerFacts,
		PlayerHero,
		PlayerLinks,
		PlayerProfileLink,
		playerPreviewId,
		PlayerStreamerIcon
	} from '@company-of-heroes/ui/player';
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
	import { labelsForSteamId } from '$core/pocketbase/player-label-cache.svelte';
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
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';

	const PROFILE_POLL_MS = 90_000;

	let activeTab = $state('stats');
	let panelExpanded = $state(false);
	let statsGeneration = $state(0);
	let unsubscribeToday = $state<UnsubscribeFunc>();
	let subscribeGeneration = 0;
	let bumpTimer: ReturnType<typeof setTimeout> | null = null;
	let profilePollTimer: ReturnType<typeof setInterval> | null = null;
	const { t } = useI18n();

	/** The running game is the admin's own; ignore it while impersonating. */
	const liveSteamId = $derived(
		app.account.isImpersonating ? null : (app.game.profile?.steam.steamid ?? null)
	);
	const linkedSteamIds = $derived(app.features.auth.user.steamIds ?? []);
	/** Another linked account to look at; back to the in-game account when the game logs in. */
	let selectedSteamId = $state<string | null>(null);
	watch(
		() => liveSteamId,
		() => {
			selectedSteamId = null;
		}
	);

	const steamId = $derived(
		(selectedSteamId && linkedSteamIds.includes(selectedSteamId) ? selectedSteamId : null) ??
			liveSteamId ??
			linkedSteamIds[0] ??
			null
	);
	const viewingLive = $derived(liveSteamId !== null && steamId === liveSteamId);

	const linkedProfiles = resource(
		() => linkedSteamIds.join(','),
		async (key) => {
			const ids = key.split(',').filter(Boolean);
			return ids.length > 1 ? steam.getUserProfiles(ids) : [];
		}
	);

	const customization = resource(
		() => steamId,
		async (id) => {
			if (!id) {
				return null;
			}

			const result = await api.players.getCustomization(id);
			return result.isOk() ? result.value : null;
		}
	);

	afterNavigate(({ from }) => {
		if (from?.url?.pathname?.includes('/account/profile')) {
			void customization.refetch();
		}
	});

	const bio = $derived.by(() => {
		const value = customization.current?.bio?.trim();
		return value ? value : null;
	});
	/** Streaming links first, then the rest. */
	const links = $derived.by(() => {
		const all = customization.current?.links ?? [];
		return [...all.filter(isStreamingLink), ...all.filter((link) => !isStreamingLink(link))];
	});

	const resolvedProfile = resource(
		() => [viewingLive ? (app.game.profile ?? null) : null, steamId] as const,
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

	const profile = $derived(
		viewingLive ? (app.game.profile ?? null) : (resolvedProfile.current ?? null)
	);
	const profileId = $derived(profile?.relic.profile_id ?? null);
	const todaySteamIds = $derived(collectTodayMatchSteamIds(steamId ? [steamId] : []));

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

			const live = viewingLive ? app.game.profile : null;
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
		async ([id]) => {
			if (!id) {
				return [];
			}

			const matches = await relic.getRecentMatchHistoryForProfile(id);
			const { enrichMatchHistoryRankLevels } = await import('$lib/player/match-history-ranks');
			const ownerStats = profile?.relic.leaderboardStats;
			return enrichMatchHistoryRankLevels(matches, id, ownerStats);
		},
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

	const heroButton = 'shrink-0 bg-gray-950/60 backdrop-blur-sm';

	const avatarBorder = $derived(
		app.lobby && viewingLive ? 'border-green-500' : 'border-secondary-800'
	);
	const profileHref = $derived(
		profileId != null
			? resolve('/(loaded)/players/[id]', { id: String(profileId) })
			: steamId
				? resolve('/(loaded)/players/[id]', { id: steamId })
				: null
	);
	const updateProfileHref = $derived(
		steamId ? `/account/profile?steamId=${encodeURIComponent(steamId)}` : '/account/profile'
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

		return `<span class="inline-flex items-center gap-1.5 leading-none"><span class="inline-flex p-[3px]"><img src="${getFactionFlagFromRace(match.raceId)}" alt="" class="${factionIcon}" /></span>${mode}</span>`;
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
			<PlayerHero backgroundUrl={customization.current?.backgroundUrl}>
				{#snippet avatar()}
					{#if profileHref && previewId}
						<PlayerProfileLink
							href={profileHref}
							playerId={previewId}
							class={cn(interactive, 'block h-full w-full')}
						>
							<img
								src={profile.steam.avatarfull}
								alt={profile.relic.alias}
								class={cn('h-full w-full rounded-md border-2 object-cover', avatarBorder)}
							/>
						</PlayerProfileLink>
					{:else}
						<img
							src={profile.steam.avatarfull}
							alt={profile.relic.alias}
							class={cn('h-full w-full rounded-md border-2 object-cover', avatarBorder)}
						/>
					{/if}
				{/snippet}
				{#snippet kicker()}
					{#if profile.relic.country}
						<img
							class="h-4 w-auto shrink-0 rounded-xs"
							src="https://flagsapi.com/{upperCase(profile.relic.country)}/shiny/64.png"
							alt={profile.relic.country}
						/>
					{/if}
					<Player.LikeCount steamId={profile.steam.steamid} class="shrink-0" />
					<PlayerStreamerIcon
						labels={labelsForSteamId(profile.steam.steamid)}
						steamId={profile.steam.steamid}
						size={20}
					/>
					<Player.Labels steamId={profile.steam.steamid} class="shrink-0" />
					{#if app.lobby && viewingLive}
						<a href={resolve('/(loaded)/current-game')} class={cn(interactive, 'shrink-0')}>
							<LiveBadge label={t('In match')} />
						</a>
					{:else if !app.game.isRunning}
						<Badge variant="default" class="shrink-0">{t('Not running')}</Badge>
					{/if}
				{/snippet}
				{#snippet title()}
					{#if profileHref && previewId}
						<PlayerProfileLink
							href={profileHref}
							playerId={previewId}
							class={cn(interactive, 'hover:text-primary min-w-0 truncate transition-colors')}
						>
							{profile.relic.alias}
						</PlayerProfileLink>
					{:else}
						<span class="truncate">{profile.relic.alias}</span>
					{/if}
				{/snippet}
				{#snippet actions()}
					{#if profileHref}
						<Button href={profileHref} variant="secondary" size="sm" class={heroButton}>
							<UserIcon size={16} />
							{t('View profile')}
						</Button>
					{/if}
					<Button href={updateProfileHref} variant="secondary" size="sm" class={heroButton}>
						<PencilSimpleIcon size={16} />
						{t('Update profile')}
					</Button>
					{#if linkedSteamIds.length > 1}
						<Dropdown.Root class="w-64">
							{#snippet trigger({ props })}
								<Button {...props} variant="secondary" size="sm" class={heroButton}>
									<UserSwitchIcon size={16} weight="duotone" />
									{t('Switch account')}
								</Button>
							{/snippet}
							{#each linkedSteamIds as id (id)}
								{@const account = linkedProfiles.current?.find((item) => item.steamid === id)}
								<Dropdown.Item
									class={dropdownItemIcon}
									onSelect={() => (selectedSteamId = id === liveSteamId ? null : id)}
								>
									{#if account?.avatar}
										<img src={account.avatar} alt="" class="size-6 shrink-0 rounded-xs" />
									{/if}
									<span class="min-w-0 flex-1 truncate">{account?.personaname ?? id}</span>
									{#if id === liveSteamId}
										<Badge variant="default" class="shrink-0">{t('In game')}</Badge>
									{/if}
									{#if id === steamId}
										<CheckIcon size={16} class="text-primary shrink-0" />
									{/if}
								</Dropdown.Item>
							{/each}
						</Dropdown.Root>
					{/if}
				{/snippet}
				{#if links.length > 0}
					<PlayerLinks {links} />
				{/if}
				{#if bio}
					<p class="text-secondary-200 text-sm leading-relaxed whitespace-pre-wrap">{bio}</p>
				{/if}
			</PlayerHero>

			<PlayerFacts>
				<PlayerFact label={t('Ladder')} icon={RankingIcon}>
					{#if featuredMode}
						<img
							src={getFactionFlagFromLeaderboardId(featuredMode.stat.leaderboard_id)}
							alt={getRaceLabelFromLeaderboardId(featuredMode.stat.leaderboard_id)}
							class={factionIcon}
						/>
						{#if featuredMode.rating == null}
							<span class="text-secondary-500">{t('N/A')}</span>
						{:else}
							<span
								class={cn(
									'text-lg',
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
							<span class="text-secondary-200 text-sm">{featuredMode.stat.ranklevel}</span>
						{/if}
					{:else}
						<span class="text-secondary-400 font-sans text-sm font-normal whitespace-normal">
							{t('Play ranked to unlock your ladder spotlight.')}
						</span>
					{/if}
					{#snippet sub()}
						{#if featuredMode}
							<span class="font-medium uppercase">{featuredMode.label}</span>
							{#if featuredMode.stat.rank > 0}
								<span class="text-secondary-600">·</span>
								<span class="tabular-nums">
									{t('#{rank} / {total}', {
										rank: featuredMode.stat.rank,
										total: featuredMode.stat.ranktotal
									})}
								</span>
							{/if}
						{/if}
					{/snippet}
				</PlayerFact>

				<PlayerFact label={t('Today')} icon={CalendarCheckIcon}>
					<span class={statWins}>{t('{count}W', { count: todayRecord.wins })}</span>
					<span class="text-secondary-600">·</span>
					<span class={statLosses}>{t('{count}L', { count: todayRecord.losses })}</span>
					{#if todayRecord.pending > 0}
						<PendingBadge label={t('{count} pending', { count: todayRecord.pending })} />
					{/if}
				</PlayerFact>

				<PlayerFact label={t('Career')} icon={TrophyIcon}>
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
						<span class="text-secondary-400 font-sans text-sm font-normal whitespace-normal">
							{t('Play with the companion running to build stats.')}
						</span>
					{/if}
				</PlayerFact>

				{#if featuredMode && featuredMode.stat.streak !== 0}
					<PlayerFact label={t('Streak')} icon={FlameIcon}>
						<LeaderboardStatPill
							type="streak"
							wins={featuredMode.stat.wins}
							losses={featuredMode.stat.losses}
							streak={featuredMode.stat.streak}
						/>
					</PlayerFact>
				{/if}

				{#if featuredMode && featuredMode.stat.highestranklevel > 0}
					<PlayerFact
						label={t('Peak')}
						icon={MountainsIcon}
						sub={featuredMode.stat.highestrank > 0
							? t('#{rank}', { rank: featuredMode.stat.highestrank })
							: null}
					>
						<img
							src={getRankImageByLeaderboardId(
								featuredMode.stat.leaderboard_id,
								featuredMode.stat.highestranklevel
							)}
							alt={t('Rank {level}', { level: featuredMode.stat.highestranklevel })}
							class="h-6 w-auto shrink-0"
						/>
						<span>{featuredMode.stat.highestranklevel}</span>
					</PlayerFact>
				{/if}

				{#if bestMap}
					<PlayerFact label={t('Best map')} icon={MapTrifoldIcon}>
						<span class="truncate">{normalizeMapName(bestMap.map, false)}</span>
						{#snippet sub()}
							<span class={statWins}>{t('{count}W', { count: bestMap.wins })}</span>
							<span class="text-secondary-600">·</span>
							<span class={statLosses}>{t('{count}L', { count: bestMap.losses })}</span>
							<span class="font-medium" style:color={getRatioColor(bestMap.wins, bestMap.losses)}>
								{winratePercent(bestMap.wins, bestMap.losses)}
							</span>
						{/snippet}
					</PlayerFact>
				{/if}

				{#if mainFaction}
					<PlayerFact label={t('Main faction')} icon={FlagIcon}>
						<img src={getFactionFlagFromRace(mainFaction.raceId)} alt="" class={factionIcon} />
						<span class="truncate">{getRaceLabel(mainFaction.raceId)}</span>
						{#snippet sub()}
							<span class={statWins}>{t('{count}W', { count: mainFaction.wins })}</span>
							<span class="text-secondary-600">·</span>
							<span class={statLosses}>{t('{count}L', { count: mainFaction.losses })}</span>
						{/snippet}
					</PlayerFact>
				{/if}

				{#if formMatches.length > 0}
					<PlayerFact label={t('Recent')} icon={ClockCounterClockwiseIcon}>
						<span class="inline-flex min-w-0 items-center gap-1 overflow-x-auto">
							{#each formMatches as match (match.id || match.sessionId)}
								<a
									href={resolve('/(loaded)/history/[id]', { id: match.id })}
									class={cn(interactive, 'group inline-flex shrink-0')}
									aria-label="{match.outcome === 1 ? t('Win') : t('Loss')} — {recentMatchLabel(
										match
									)}"
									{@attach tooltip(recentMatchTooltip(match))}
								>
									<Badge variant={match.outcome === 1 ? 'success' : 'destructive'}>
										{match.outcome === 1 ? t('W') : t('L')}
									</Badge>
								</a>
							{/each}
						</span>
					</PlayerFact>
				{/if}
			</PlayerFacts>

			<div>
				<Tabs.Root bind:value={activeTab}>
					<div class="flex items-center justify-between px-4">
						<Tabs.List
							class={cn(
								!panelExpanded &&
									'[&_[data-state=active]]:text-secondary-400 [&_[data-state=active]]:after:bg-transparent'
							)}
						>
							<Tabs.Trigger value="stats" onclick={() => openTab('stats')}
								>{t('Stats')}</Tabs.Trigger
							>
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
								<PlayerStatsTable stats={profile.relic.leaderboardStats ?? []} elo={playerElo} />
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
	<Player.WidgetSkeleton />
{:else}
	<Alert variant="warning">
		{t('Company of Heroes is not running. Start the game to see your profile and match tracking.')}
	</Alert>
{/if}
