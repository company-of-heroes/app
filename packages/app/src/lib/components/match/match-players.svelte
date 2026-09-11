<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { LobbyPlayer } from '@fknoobs/app';
	import { useMatch } from '.';
	import { cn, getFactionFlagFromRace, getRankImage } from '$lib/utils';
	import { getLeaderboardStatsForPlayerByMatchType, Race } from '$lib/utils/game';
	import { getMeSteamIds } from '$lib/utils/player-me';
	import { useI18n } from '$lib/i18n';
	import { resolveTeamOutcome } from './match-view';
	import { TeamPlayerSkills } from '@company-of-heroes/ui/match';
	import { getModeLabel } from '@company-of-heroes/ui/format/player-format';

	type Props = {
		team: 'allies' | 'axis';
		highlightedPlayers?: string[];
	} & HTMLAttributes<HTMLSpanElement>;

	let { team, highlightedPlayers = [], ...restProps }: Props = $props();
	const { t } = useI18n();
	const match = useMatch();
	const meSteamIds = $derived(getMeSteamIds());
	const outcome = $derived(resolveTeamOutcome(match, team) ?? null);

	function onTeam(player: LobbyPlayer, side: 'allies' | 'axis') {
		if (player.team === 0 || player.team === 1) {
			return side === 'allies' ? player.team === 0 : player.team === 1;
		}

		if (side === 'allies') {
			return player.race === Race.US || player.race === Race.Commonwealth;
		}

		return player.race === Race.Wehrmacht || player.race === Race.PanzerElite;
	}

	const players = $derived(match.players?.filter((player) => onTeam(player, team)) || []);

	const matchTypeId = $derived.by(() => {
		if (!match.isRanked) {
			return 0;
		}

		const fromResult = Number(match.result?.matchtype_id);
		if (Number.isFinite(fromResult) && fromResult >= 1 && fromResult <= 4) {
			return fromResult;
		}
		if (fromResult === 14) {
			return 14;
		}

		const humans = (match.players ?? []).filter((player) => player.playerId !== -1);
		if (humans.length === 2) {
			return 1;
		}
		if (humans.length === 4) {
			return 2;
		}
		if (humans.length === 6) {
			return 3;
		}
		if (humans.length === 8) {
			return 4;
		}
		return 0;
	});

	function playerHref(player: LobbyPlayer) {
		if (player.playerId === -1) {
			return null;
		}

		if (player.profile?.profile_id) {
			return `/players/${player.profile.profile_id}`;
		}

		if (player.steamId) {
			return `/players/${player.steamId}`;
		}

		return null;
	}

	function resolveStats(player: LobbyPlayer) {
		if (
			player.stats &&
			(player.stats.rankLevel > 0 ||
				player.stats.rank > 0 ||
				player.stats.wins > 0 ||
				player.stats.losses > 0 ||
				player.stats.elo != null)
		) {
			return player.stats;
		}

		const lb = getLeaderboardStatsForPlayerByMatchType(matchTypeId, player);
		if (!lb) {
			return player.stats ?? null;
		}

		return {
			elo: null,
			wins: lb.wins ?? 0,
			losses: lb.losses ?? 0,
			streak: lb.streak ?? 0,
			rank: lb.rank ?? 0,
			rankLevel: lb.ranklevel ?? 0
		};
	}

	const skillPlayers = $derived(
		players.map((player) => ({
			race: player.race ?? null,
			alias: player.profile?.alias || player.name || t('Unknown'),
			steamId: player.steamId ?? null,
			profileId: player.profile?.profile_id ?? (player.playerId > 0 ? player.playerId : null),
			stats: resolveStats(player),
			href: playerHref(player),
			country: player.profile?.country ?? null
		}))
	);
	const modeLabel = $derived(getModeLabel(matchTypeId));
</script>

<span {...restProps} class={cn('inline-flex items-center', restProps.class)}>
	<TeamPlayerSkills
		players={skillPlayers}
		resolveFactionFlag={getFactionFlagFromRace}
		{getRankImage}
		{meSteamIds}
		{highlightedPlayers}
		{outcome}
		{modeLabel}
		levelFallback="-"
		showRankBadges={match.isRanked}
	/>
</span>
