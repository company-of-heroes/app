import { errAsync, ResultAsync } from 'neverthrow';
import { cached } from '../cache';
import { badRequest } from '../errors';
import type { Task } from '../result';
import {
	isRankedLeaderboard,
	isValidSteamId,
	steamIdFromRelicName,
	type EloMap
} from '../domain/ratings';
import type { PlayerLabel } from './player-info';
import { Service } from './service';

export type LeaderboardStat = {
	leaderboard_id: number;
	rank: number;
	ranklevel: number;
	wins: number;
	losses: number;
	streak: number;
	profile: {
		profile_id: number;
		alias: string;
		country: string | null;
		name: string;
		avatarUrl?: string;
		labels: PlayerLabel[];
		likeCount?: number;
	};
};

export type Leaderboard = {
	leaderboardId: number;
	stats: LeaderboardStat[];
	eloBySteamId: Record<string, EloMap>;
};

type RelicLeaderboard = {
	statGroups?: {
		members?: {
			personal_statgroup_id: number;
			profile_id: number;
			alias?: string;
			country?: string;
			name?: string;
		}[];
	}[];
	leaderboardStats?: {
		statgroup_id: number;
		leaderboard_id: number;
		rank: number;
		ranklevel: number;
		wins: number;
		losses: number;
		streak: number;
	}[];
};

const TOP_WITH_AVATARS = 3;
/** Relic's ladder moves slowly; one fetch per board per data center every few minutes. */
const CACHE_SECONDS = 300;

function joinStats(data: RelicLeaderboard): LeaderboardStat[] {
	const members = new Map(
		(data.statGroups ?? [])
			.flatMap((group) => group.members ?? [])
			.map((member) => [member.personal_statgroup_id, member])
	);
	return (data.leaderboardStats ?? []).flatMap((stat) => {
		const member = members.get(stat.statgroup_id);
		if (!member) {
			return [];
		}

		return [
			{
				leaderboard_id: Number(stat.leaderboard_id) || 0,
				rank: Number(stat.rank) || 0,
				ranklevel: Number(stat.ranklevel) || 0,
				wins: Number(stat.wins) || 0,
				losses: Number(stat.losses) || 0,
				streak: Number(stat.streak) || 0,
				profile: {
					profile_id: Number(member.profile_id) || 0,
					alias: member.alias ?? '',
					country: member.country ?? null,
					name: member.name ?? '',
					labels: []
				}
			}
		];
	});
}

export class LeaderboardService extends Service {
	private load(leaderboardId: number): Task<Leaderboard> {
		return this.relic
			.get<RelicLeaderboard>(
				`/community/leaderboard/getleaderboard2?title=coh1&leaderboard_id=${leaderboardId}&count=200`
			)
			.andThen((data) => {
				const stats = joinStats(data);
				const steamIds = stats.map((stat) => steamIdFromRelicName(stat.profile.name));
				const playerInfo = this.services.playerInfo;
				return ResultAsync.combine([
					playerInfo.elo(steamIds),
					playerInfo.labels(steamIds),
					playerInfo.likeCounts(steamIds),
					this.steam.playerSummaries(steamIds.slice(0, TOP_WITH_AVATARS).filter(isValidSteamId))
				]).map(([elo, labels, likes, avatars]) => {
					stats.forEach((stat, i) => {
						const steamId = steamIds[i];
						stat.profile.labels = labels.get(steamId) ?? [];
						if (likes.has(steamId)) {
							stat.profile.likeCount = likes.get(steamId);
						}

						const avatar = avatars.get(steamId)?.avatarfull;
						if (i < TOP_WITH_AVATARS && avatar) {
							stat.profile.avatarUrl = avatar;
						}
					});
					return { leaderboardId, stats, eloBySteamId: Object.fromEntries(elo) };
				});
			});
	}

	/** One ranked Relic ladder (ids 4-19): top 200 with stored ELO, labels, likes, top-3 avatars. */
	get(leaderboardId: number): Task<Leaderboard> {
		if (!isRankedLeaderboard(leaderboardId)) {
			return errAsync(badRequest('leaderboard id must be a ranked Relic id (4-19)'));
		}

		return cached(`leaderboard:${leaderboardId}`, CACHE_SECONDS, () => this.load(leaderboardId));
	}
}
