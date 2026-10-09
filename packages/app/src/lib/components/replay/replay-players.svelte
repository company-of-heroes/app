<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { TransformedMatch } from '@fknoobs/app';
	import type { MatchExpanded } from '$core/app/database/matches';
	import {
		Overview,
		type CommunityMatchDetail,
		type CommunityPlayer
	} from '@company-of-heroes/ui/replay';
	import type { LiveLobbyPlayer } from '@company-of-heroes/ui/live-lobby';
	import { useReplay } from '.';
	import * as PlayerUi from '$lib/components/player';
	import { cn } from '$lib/utils';
	import {
		getLeaderboardStatsForPlayerByMatchType,
		getPlayerEloFromMatchHistory
	} from '$lib/utils/game';
	import {
		getLiveLobbyMatchType,
		getPlayerAlias,
		getPlayerProfileId
	} from '$lib/components/widgets/dashboard-utils';
	import { loadCheaterSteamIds } from '$core/pocketbase/anti-cheat';
	import { preloadPlayerLabels } from '$core/pocketbase/player-label-cache.svelte';
	import {
		likeCountForSteamId,
		preloadPlayerLikeCounts
	} from '$core/pocketbase/player-vote-cache.svelte';
	import { resource } from 'runed';
	import { useI18n } from '$lib/i18n';

	type Props = {} & HTMLAttributes<HTMLDivElement> & {
			flush?: boolean;
			match?: MatchExpanded | null;
		};

	let { flush = false, match = null, class: className, ...restProps }: Props = $props();
	const { t } = useI18n();
	const replay = $derived(useReplay());

	const result = $derived((match?.result as TransformedMatch | null | undefined) ?? null);
	const matchType = $derived(
		result?.matchtype_id ?? getLiveLobbyMatchType(match?.players ?? [], match?.isRanked ?? false)
	);
	const cheaters = resource(
		() =>
			(match?.players ?? [])
				.map((player) => player.steamId)
				.filter(Boolean)
				.join(','),
		(key) => loadCheaterSteamIds(key ? key.split(',') : [])
	);

	$effect(() => {
		const ids = (match?.players ?? []).map((player) => player.steamId).filter(Boolean) as string[];
		if (ids.length > 0) {
			preloadPlayerLabels(ids);
			preloadPlayerLikeCounts(ids);
		}
	});

	const overviewMatch = $derived.by((): CommunityMatchDetail => {
		const players: CommunityPlayer[] = (match?.players ?? []).map((player) => {
			const profileId = getPlayerProfileId(player) ?? 0;
			return {
				playerId: player.playerId ?? null,
				steamId: player.steamId ?? null,
				race: player.race ?? null,
				likeCount: likeCountForSteamId(player.steamId) ?? undefined,
				profile: {
					profile_id: profileId,
					alias: getPlayerAlias(player)
				}
			};
		});

		return {
			id: match?.id ?? '',
			map: match?.map ?? '',
			isRanked: !!match?.isRanked,
			createdAt: match?.createdAt ?? '',
			durationSeconds: null,
			likeCount: match?.likeCount ?? 0,
			downloadCount: match?.downloadCount ?? 0,
			players,
			result: result ?? null
		};
	});

	const livePlayers = $derived.by((): LiveLobbyPlayer[] => {
		return (match?.players ?? []).map((player, index) => {
			const profileId = getPlayerProfileId(player) ?? null;
			const isCpu = player.playerId === -1;
			const statsRow = isCpu ? null : getLeaderboardStatsForPlayerByMatchType(matchType, player);
			const country = isCpu ? null : player.profile?.country || null;
			const elo = isCpu ? null : getPlayerEloFromMatchHistory(matchType, player);
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
				likeCount: isCpu ? undefined : (likeCountForSteamId(player.steamId) ?? undefined),
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
</script>

{#snippet nameExtra(args: { name: string; steamId: string | null; profileId: number | null })}
	{@const lobbyPlayer = (match?.players ?? []).find((player) => {
		if (args.profileId != null && getPlayerProfileId(player) === args.profileId) {
			return true;
		}

		if (args.steamId && player.steamId === args.steamId) {
			return true;
		}

		return getPlayerAlias(player).trim().toLowerCase() === args.name.trim().toLowerCase();
	})}
	{#if lobbyPlayer}
		<PlayerUi.Root player={lobbyPlayer} race={lobbyPlayer.race}>
			<PlayerUi.Labels class="shrink-0" />
			{#if lobbyPlayer.steamId && cheaters.current?.has(lobbyPlayer.steamId)}
				<PlayerUi.CheaterAlert compact />
			{/if}
		</PlayerUi.Root>
	{/if}
{/snippet}

<div
	{...restProps}
	class={cn(flush ? undefined : 'border-secondary-800 overflow-clip rounded-lg border', className)}
>
	<Overview match={overviewMatch} {livePlayers} {nameExtra} />
</div>
