<script lang="ts">
	import { RankIcon } from '@company-of-heroes/ui/player';
	import { isStreamingLink } from '@company-of-heroes/api';
	import { api, unwrapApi } from '$core/api';
	import * as Reward from '@company-of-heroes/ui/reward';
	import { app } from '$core/app/context';
	import { Alert } from '$lib/components/ui/alert';
	import { PlayerStatsTable } from '@company-of-heroes/ui/player';
	import { LeaderboardStatPill } from '@company-of-heroes/ui/leaderboard';
	import { MatchHistory } from '../match-history';
	import { PlayerPerformance } from '$lib/components/player-performance';
	import { relic, relicLeaderboardFingerprint } from '$lib/relic';
	import { steam } from '$core/steam';
	import { cn, getFactionFlagFromRace, normalizeMapName } from '$lib/utils';
	import { getFactionFlagFromLeaderboardId } from '$lib/utils/game';
	import { interactive, statLosses, statWins, factionIcon } from '$lib/components/ui/variants';
	import * as Tabs from '$lib/components/ui/tabs';
	import { resource, watch } from 'runed';
	import { onDestroy, onMount } from 'svelte';
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
	import StarIcon from 'phosphor-svelte/lib/StarIcon';
	import TrophyIcon from 'phosphor-svelte/lib/TrophyIcon';
	import UserIcon from 'phosphor-svelte/lib/UserIcon';
	import UserSwitchIcon from 'phosphor-svelte/lib/UserSwitchIcon';
	import * as Dropdown from '$lib/components/ui/dropdown';
	import { dropdownItemIcon } from '@company-of-heroes/ui/variants';
	import * as Player from '$lib/components/player';
	import {
		MatchResultStrip,
		PlayerFact,
		PlayerFacts,
		PlayerHero,
		PlayerLinks,
		PlayerProfileLink,
		playerPreviewId,
		PlayerNameIcons
	} from '@company-of-heroes/ui/player';
	import { Badge, LiveBadge, PendingBadge } from '$lib/components/ui/badge';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		collectTodayMatchSteamIds,
		countTodayRecord,
		isMatchFromLocalToday,
		matchIncludesSteamIds
	} from './dashboard-utils';
	import { useTodayLobbies } from './today-lobbies.svelte';
	import { getPlayerRating } from '$core/pocketbase/player-ratings';
	import { labelsForSteamId } from '$core/pocketbase/player-label-cache.svelte';
	import { eloMapForSteamId, mergeEloMaps } from '$lib/utils/player-elo';
	import { useI18n } from '$lib/i18n';
	import {
		emptyPlayerPerformance,
		getPlayerPerformance,
		invalidatePlayerPerformanceCache
	} from '$core/pocketbase/player-performance';
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
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';

	const PROFILE_POLL_MS = 90_000;
	const STATS_BUMP_MS = 5_000;

	let activeTab = $state('stats');
	let panelExpanded = $state(false);
	let statsGeneration = $state(0);
	let lastBumpAt = 0;
	let bumpTimer: ReturnType<typeof setTimeout> | null = null;
	let profilePollTimer: ReturnType<typeof setInterval> | null = null;
	const { t } = useI18n();

	/** The running game is the admin's own; ignore it while impersonating. */
	const liveSteamId = $derived(
		app.account.isImpersonating ? null : (app.game.profile?.steam.steamid ?? null)
	);
	const linkedSteamIds = $derived(app.features.auth.user.steamIds ?? []);
	/** The first linked Steam ID: it shows the account rewards. */
	const mainSteamId = $derived(linkedSteamIds[0] ?? null);
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

	/** At most one stats refetch per 5 s; events in between share the pending bump. */
	function bumpStats() {
		invalidatePlayerPerformanceCache(profileId ?? undefined);
		if (bumpTimer) {
			return;
		}

		bumpTimer = setTimeout(
			() => {
				bumpTimer = null;
				lastBumpAt = Date.now();
				statsGeneration += 1;
			},
			Math.max(300, lastBumpAt + STATS_BUMP_MS - Date.now())
		);
	}

	async function refreshRelicLeaderboards() {
		const id = steamId;
		if (!id) {
			return;
		}

		try {
			const relicProfile = await relic.getProfileBySteamId(id, { fresh: true });
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

	const todayLobbies = useTodayLobbies();
	const todayMatches = $derived(
		todayLobbies.items.filter(
			(match) => isMatchFromLocalToday(match) && matchIncludesSteamIds(match, todaySteamIds)
		)
	);

	// Always loaded (public matches only): its ratings fill the ELO of the always-visible facts.
	const recentMatches = resource(
		() => [profileId, statsGeneration] as const,
		async ([id]) => (id ? relic.getRecentMatchHistoryForProfile(id) : []),
		{ initialValue: [] }
	);

	// The rank enrichment (personal stat batches) only runs while the panel is open.
	const rankedRecentMatches = resource(
		() => (panelExpanded ? recentMatches.current : null),
		async (matches) => {
			const id = profileId;
			if (!matches || !id) {
				return [];
			}

			const { enrichMatchHistoryRankLevels } = await import('$lib/player/match-history-ranks');
			return enrichMatchHistoryRankLevels(matches, id, profile?.relic.leaderboardStats);
		}
	);

	const todayRecord = $derived(
		countTodayRecord(todayMatches, profileId ?? undefined, todaySteamIds)
	);

	const storedRating = resource(
		() => [steamId, statsGeneration] as const,
		async ([id]) => (id ? getPlayerRating(id) : null)
	);
	// Own rewards for the shown Steam ID (unlocked + progress); refetched after a match result
	// and when the main account changes (only the main Steam ID carries the account rewards).
	const rewards = resource(
		() => [steamId, mainSteamId, linkedSteamIds.join(','), statsGeneration] as const,
		async ([id]) => (id ? unwrapApi(api.rewards.forPlayer(id)).catch(() => null) : null)
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

			return getPlayerPerformance({ profileId: id, scope: 'user', userId });
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

	// A today match got its result: refresh the stats (replaces the old per-widget subscription).
	watch(
		() =>
			[
				todaySteamIds.join(','),
				todayLobbies.loading,
				todayMatches.filter((match) => !match.needsResult).length
			] as const,
		([steamIdsKey, loading, resolved], previous) => {
			if (
				previous &&
				!loading &&
				!previous[1] &&
				previous[0] === steamIdsKey &&
				resolved > previous[2]
			) {
				bumpStats();
			}
		}
	);

	onMount(() => {
		void refreshRelicLeaderboards();
		profilePollTimer = setInterval(() => void refreshRelicLeaderboards(), PROFILE_POLL_MS);
	});

	onDestroy(() => {
		if (bumpTimer) {
			clearTimeout(bumpTimer);
		}

		if (profilePollTimer) {
			clearInterval(profilePollTimer);
			profilePollTimer = null;
		}

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

	async function makeMain(id: string) {
		try {
			await app.account.setMainSteamId(id);
			app.toast.success(t('Main Steam account changed.'));
			statsGeneration += 1;
		} catch (error) {
			app.toast.error(
				error instanceof Error ? error.message : t('Could not change your main Steam account.')
			);
		}
	}

	function openTab(tab: string) {
		activeTab = tab;
		panelExpanded = true;
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
						<PlayerProfileLink href={profileHref} class={cn(interactive, 'block h-full w-full')}>
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
					<PlayerNameIcons
						labels={labelsForSteamId(profile.steam.steamid)}
						steamId={profile.steam.steamid}
						size={20}
					/>
					<Player.Labels steamId={profile.steam.steamid} class="shrink-0" />
					{#if app.lobby && viewingLive && app.liveLobbyId}
						<a
							href={resolve('/(loaded)/history/[id]', { id: app.liveLobbyId })}
							class={cn(interactive, 'flex shrink-0')}
						>
							<LiveBadge label={t('In match')} />
						</a>
					{:else if app.lobby && viewingLive}
						<LiveBadge label={t('In match')} class="shrink-0" />
					{:else if !app.game.isRunning}
						<Badge variant="default" class="shrink-0">{t('Not running')}</Badge>
					{/if}
				{/snippet}
				{#snippet title()}
					{#if profileHref && previewId}
						<PlayerProfileLink
							href={profileHref}
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
									{#if id === mainSteamId}
										<Badge class="shrink-0">{t('Main')}</Badge>
									{/if}
									{#if id === liveSteamId}
										<Badge variant="default" class="shrink-0">{t('In game')}</Badge>
									{/if}
									{#if id === steamId}
										<CheckIcon size={16} class="text-primary shrink-0" />
									{/if}
								</Dropdown.Item>
							{/each}
							{#if steamId && steamId !== mainSteamId && !app.account.isImpersonating}
								<Dropdown.Separator />
								<Dropdown.Item class={dropdownItemIcon} onSelect={() => makeMain(steamId)}>
									<StarIcon size={18} weight="duotone" class="text-primary shrink-0" />
									<span class="min-w-0 flex-1">{t('Make this my main account')}</span>
								</Dropdown.Item>
							{/if}
						</Dropdown.Root>
					{/if}
				{/snippet}
				{#if links.length > 0}
					<PlayerLinks {links} />
				{/if}
				{#if bio}
					<p class="text-secondary-200 text-sm leading-relaxed whitespace-pre-wrap">{bio}</p>
				{/if}
				<Reward.Icons
					steamId={profile.steam.steamid}
					rewards={rewards.current ?? null}
					class="mb-0"
				/>
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
							<RankIcon
								level={featuredMode.stat.ranklevel}
								leaderboardId={featuredMode.stat.leaderboard_id}
								position={featuredMode.stat.rank}
								class="size-auto h-6"
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
						<RankIcon
							level={featuredMode.stat.highestranklevel}
							leaderboardId={featuredMode.stat.leaderboard_id}
							class="size-auto h-6"
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
						<MatchResultStrip matches={formMatches} />
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
								{#if recentMatches.loading || rankedRecentMatches.loading || !rankedRecentMatches.current}
									<div class="divide-secondary-800 border-secondary-800 divide-y border-t">
										{#each Array(5) as _, index (index)}
											<div class="px-4 py-3">
												<Skeleton class="h-4 w-full" />
											</div>
										{/each}
									</div>
								{:else}
									<MatchHistory matches={rankedRecentMatches.current ?? []} showSessionId />
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
