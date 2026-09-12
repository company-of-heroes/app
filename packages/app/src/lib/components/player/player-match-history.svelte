<script lang="ts">
	import {
		PlayerMatchHistory,
		type PlayerPageData,
		type TransformedMatch
	} from '@company-of-heroes/ui/player';
	import { confirm } from '@tauri-apps/plugin-dialog';
	import EyeIcon from 'phosphor-svelte/lib/Eye';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlash';
	import { resource } from 'runed';
	import { app } from '$core/app/context';
	import {
		hideMatch,
		isHiddenFromPublic,
		listHiddenKeywordWords,
		listHiddenSessionIds,
		titleMatchesHiddenKeyword,
		unhideMatch
	} from '$core/pocketbase/hidden-matches';
	import {
		labelsForSteamId,
		preloadPlayerLabels
	} from '$core/pocketbase/player-label-cache.svelte';
	import {
		likeCountForSteamId,
		preloadPlayerLikeCounts
	} from '$core/pocketbase/player-vote-cache.svelte';
	import { steam } from '$core/steam';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import dayjs from '$lib/dayjs';
	import { useI18n } from '$lib/i18n';
	import { getFactionFlagFromRace, getRankImage, normalizeMapName } from '$lib/utils';
	import { getMapImageFromName } from '$lib/utils/game';

	type Props = {
		player: PlayerPageData;
	};

	let { player }: Props = $props();
	const { t } = useI18n();

	const isStaff = $derived(app.account.isStaff);
	let pendingSessionId = $state<number | null>(null);

	const hiddenIds = resource(
		() => true,
		() => listHiddenSessionIds()
	);
	const hiddenWords = resource(
		() => true,
		() => listHiddenKeywordWords()
	);

	const orderedMatches = $derived(
		[...player.matchHistory].sort((a, b) => b.completiontime - a.completiontime)
	);

	const visibleMatches = $derived.by(() => {
		if (isStaff) {
			return orderedMatches;
		}

		if (hiddenIds.current == null || hiddenWords.current == null || hiddenIds.error || hiddenWords.error) {
			return [];
		}

		const ids = hiddenIds.current;
		const words = hiddenWords.current;
		return orderedMatches.filter(
			(match) => !ids.has(match.id) && !titleMatchesHiddenKeyword(match.description, words)
		);
	});

	const steamIdsKey = $derived(
		[
			...new Set(
				visibleMatches.flatMap((match) =>
					match.players.map((p) => p.steamId).filter((id): id is string => Boolean(id))
				)
			)
		]
			.sort()
			.join(',')
	);

	const avatarBySteamId = resource(
		() => steamIdsKey,
		async (key) => {
			if (!key) {
				return new Map<string, string>();
			}

			const ids = key.split(',');
			const profiles = await steam.getUserProfiles(ids).catch((error) => {
				console.warn('[MATCH-HISTORY]: steam avatar lookup failed:', error);
				return [];
			});

			return new Map(
				profiles
					.filter((profile) => profile.avatarfull)
					.map((profile) => [profile.steamid, profile.avatarfull])
			);
		},
		{ initialValue: new Map<string, string>() }
	);

	$effect(() => {
		if (!steamIdsKey) {
			return;
		}

		const ids = steamIdsKey.split(',');
		preloadPlayerLabels(ids);
		preloadPlayerLikeCounts(ids);
	});

	const visiblePlayer = $derived.by(() => {
		const avatars = avatarBySteamId.current ?? new Map<string, string>();
		return {
			...player,
			matchHistory: visibleMatches.map((match) => ({
				...match,
				players: match.players.map((matchPlayer) => ({
					...matchPlayer,
					avatarUrl:
						matchPlayer.avatarUrl ??
						(matchPlayer.steamId ? (avatars.get(matchPlayer.steamId) ?? null) : null),
					labels: matchPlayer.labels ?? labelsForSteamId(matchPlayer.steamId),
					likeCount: matchPlayer.likeCount ?? likeCountForSteamId(matchPlayer.steamId) ?? undefined
				}))
			}))
		};
	});

	const sessionIdsKey = $derived(orderedMatches.map((match) => match.id).join(','));
	const savedBySession = resource(
		() => sessionIdsKey,
		(key) => {
			if (!key) {
				return Promise.resolve(new Map<number, string>());
			}

			return app.database.matches.getIdsBySessionIds(key.split(',').map(Number)).catch((error) => {
				console.warn('[MATCH-HISTORY]: saved match lookup failed:', error);
				return new Map<number, string>();
			});
		}
	);

	function flagImageUrl(country: string | null | undefined): string | null {
		if (!country) {
			return null;
		}

		return `https://flagsapi.com/${country.toUpperCase()}/flat/64.png`;
	}

	function playerHref(steamId: string): string {
		return `/players/${steamId}`;
	}

	function resolveFactionFlag(raceId: number): string {
		return getFactionFlagFromRace(raceId);
	}

	function resolveMapSrc(map: string | undefined): string | undefined {
		return getMapImageFromName(map);
	}

	function detailsHref(match: TransformedMatch): string | null {
		const id = savedBySession.current?.get(match.id);
		return id ? `/history/${id}` : null;
	}

	function formatSessionId(id: number): string {
		return t('ID: {id}', { id });
	}

	function formatTimestamp(unixSeconds: number): string {
		return dayjs.unix(unixSeconds).format('MMM D, YYYY · HH:mm');
	}

	async function toggleHidden(sessionId: number, currentlyHidden: boolean) {
		const confirmed = await confirm(
			currentlyHidden
				? t('Show this match on public overviews again?')
				: t('Hide this match from public overviews?'),
			{
				okLabel: currentlyHidden ? t('Show') : t('Hide'),
				cancelLabel: t('Cancel'),
				kind: 'warning'
			}
		);
		if (!confirmed) {
			return;
		}

		pendingSessionId = sessionId;
		try {
			if (currentlyHidden) {
				await unhideMatch(sessionId);
				app.toast.success(t('Match is visible again.'));
			} else {
				await hideMatch(sessionId, app.account.userId);
				app.toast.success(t('Match hidden from public overviews.'));
			}

			const next = new Set(hiddenIds.current ?? []);
			if (currentlyHidden) {
				next.delete(sessionId);
			} else {
				next.add(sessionId);
			}

			hiddenIds.mutate(next);
		} catch (error) {
			console.error('[MATCH-HISTORY]: hide toggle failed:', error);
			app.toast.error(
				currentlyHidden ? t('Could not show this match.') : t('Could not hide this match.')
			);
		} finally {
			pendingSessionId = null;
		}
	}
</script>

{#snippet matchActions({ match }: { match: TransformedMatch })}
	{@const isManuallyHidden = hiddenIds.current?.has(match.id) ?? false}
	{@const isHidden = isHiddenFromPublic(
		match.id,
		match.description,
		hiddenIds.current,
		hiddenWords.current
	)}
	{#if isStaff && isHidden}
		<Badge variant="warning">{t('Hidden')}</Badge>
	{/if}
	{#if isStaff}
		<Button
			type="button"
			size="sm"
			variant="secondary"
			loading={pendingSessionId === match.id}
			onclick={() => toggleHidden(match.id, isManuallyHidden)}
		>
			{#if isManuallyHidden}
				<EyeIcon class="size-4" />
				{t('Show match')}
			{:else}
				<EyeSlashIcon class="size-4" />
				{t('Hide match')}
			{/if}
		</Button>
	{/if}
{/snippet}

<PlayerMatchHistory
	player={visiblePlayer}
	{flagImageUrl}
	{playerHref}
	{resolveFactionFlag}
	{resolveMapSrc}
	{getRankImage}
	{formatTimestamp}
	formatMapName={normalizeMapName}
	showAvatars
	emptyMessage={t('No recent matches found.')}
	changeLabel={t('Change')}
	teamLabel={t('Team')}
	eloLabel={t('ELO')}
	rankLabel={t('Rank')}
	playerLabel={t('Player')}
	winsLabel={t('Wins')}
	lossesLabel={t('Losses')}
	streakLabel={t('Streak')}
	showSessionId
	{detailsHref}
	detailsLabel={t('View match')}
	{formatSessionId}
	{matchActions}
/>
