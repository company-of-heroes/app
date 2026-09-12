import type {
	PlayerEloMap,
	PlayerLabel,
	PlayerPageData,
	PlayerPerformance,
	PlayerSmurf,
	TransformedMatch
} from '@company-of-heroes/ui/player';
import type { TransformedMatch as AppTransformedMatch } from '@fknoobs/app';
import type { SteamPlayerSummary } from '$core/steam';
import type { SmurfAlertState } from '$lib/player/smurf';
import { emptyPlayerPerformance } from '$core/pocketbase/player-performance';

type RelicProfileLike = {
	profile_id: number;
	alias: string;
	country?: string | null;
	level: number;
	leaderboardStats?: PlayerPageData['leaderboardStats'];
};

export function toPlayerSmurf(smurf: SmurfAlertState | null | undefined): PlayerSmurf | null {
	if (!smurf || smurf.status !== 'shared') {
		return null;
	}

	return {
		lenderSteamId: smurf.lenderSteamId,
		lenderProfileId: smurf.lenderProfile?.profile_id ?? null,
		lenderAlias:
			smurf.lenderProfile?.alias ?? smurf.lenderSteam?.personaname ?? 'Original account',
		lenderAvatarUrl: smurf.lenderSteam?.avatarfull ?? null
	};
}

export function toUiMatchHistory(matches: AppTransformedMatch[]): TransformedMatch[] {
	return matches.map((match) => ({
		id: match.id,
		mapname: match.mapname,
		matchtype_id: match.matchtype_id,
		startgametime: match.startgametime,
		completiontime: match.completiontime,
		outcome: match.outcome,
		description: match.description,
		players: match.players.map((player) => {
			const enriched = player as typeof player & {
				labels?: PlayerLabel[];
				likeCount?: number;
				avatarUrl?: string | null;
			};

			return {
				profile_id: enriched.profile_id,
				alias: enriched.alias,
				steamId: enriched.steamId,
				teamid: enriched.teamid,
				race_id: enriched.race_id,
				wins: enriched.wins,
				losses: enriched.losses,
				streak: enriched.streak,
				outcome: enriched.outcome,
				oldrating: enriched.oldrating,
				newrating: enriched.newrating,
				ranklevel: enriched.ranklevel,
				country: enriched.country,
				labels: enriched.labels,
				likeCount: enriched.likeCount,
				avatarUrl: enriched.avatarUrl
			};
		})
	}));
}

export function toPlayerPageData(input: {
	profile: RelicProfileLike;
	user: SteamPlayerSummary;
	game?: { playtime_forever?: number; playtime_2weeks?: number } | null;
	elo?: PlayerEloMap;
	performance?: PlayerPerformance | null;
	matchHistory?: AppTransformedMatch[];
	smurf?: SmurfAlertState | null;
	labels?: PlayerLabel[] | null;
	likeCount?: number;
}): PlayerPageData {
	return {
		steamId: input.user.steamid,
		profileId: input.profile.profile_id,
		alias: input.profile.alias,
		country: input.profile.country ?? null,
		level: input.profile.level,
		avatarUrl: input.user.avatarfull,
		personastate: input.user.personastate,
		gameextrainfo: input.user.gameextrainfo ?? null,
		lastlogoff: input.user.lastlogoff ?? null,
		timecreated: input.user.timecreated ?? null,
		playtimeForever: input.game?.playtime_forever ?? null,
		playtime2weeks: input.game?.playtime_2weeks ?? null,
		leaderboardStats: input.profile.leaderboardStats ?? [],
		elo: input.elo ?? {},
		performance: input.performance ?? emptyPlayerPerformance(),
		matchHistory: toUiMatchHistory(input.matchHistory ?? []),
		smurf: toPlayerSmurf(input.smurf),
		labels: input.labels ?? [],
		likeCount: input.likeCount ?? 0
	};
}
