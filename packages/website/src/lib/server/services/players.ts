import { okAsync, ResultAsync } from 'neverthrow';
import { cached } from '../cache';
import { avatarOf } from '../clients/steam';
import { steamIdFromRelicName } from '../domain/ratings';
import { badRequest } from '../errors';
import { ensure, type Task } from '../result';
import { Service } from './service';

export type PlayerSearchItem = {
	profileId: number;
	alias: string;
	country: string | null;
	level: number;
	steamId: string;
	avatarUrl: string;
	matchCount: number;
	likeCount?: number;
};

type RelicMember = {
	profile_id: number;
	alias?: string;
	country?: string;
	level?: number;
	name?: string;
	personal_statgroup_id?: number;
};
type RelicPersonalStat = {
	result?: { code?: number };
	statGroups?: { members?: RelicMember[] }[];
	leaderboardStats?: { statgroup_id: number; wins?: number; losses?: number }[];
};

const MAX_RESULTS = 20;
/** Relic's "no match" result code for fuzzy search; then try the exact alias. */
const RELIC_NOT_FOUND = 10;

function uniqueMembers(data: RelicPersonalStat): RelicMember[] {
	const seen = new Set<number>();
	return (data.statGroups ?? [])
		.flatMap((group) => group.members ?? [])
		.filter((member) => {
			const id = Number(member.profile_id);
			if (!id || seen.has(id)) {
				return false;
			}

			seen.add(id);
			return true;
		});
}
type RelicSearch = { members: RelicMember[]; stats: RelicStat[] };
type RelicStat = NonNullable<RelicPersonalStat['leaderboardStats']>[number];

const personalStat = (query: string) =>
	`/community/leaderboard/getpersonalstat?title=coh1&${query}`;

export class PlayersService extends Service {
	/** Relic name search; falls back to an exact alias lookup when the fuzzy search finds nothing. */
	private searchRelic(query: string): Task<RelicSearch> {
		return this.relic
			.get<RelicPersonalStat>(personalStat(`search=${encodeURIComponent(query)}`))
			.andThen((data) =>
				data.result?.code !== RELIC_NOT_FOUND
					? okAsync({
							members: uniqueMembers(data).slice(0, MAX_RESULTS),
							stats: data.leaderboardStats ?? []
						})
					: this.exactAlias(query)
			);
	}

	private exactAlias(query: string): Task<RelicSearch> {
		return this.relic
			.get<RelicPersonalStat>(
				personalStat(`aliases=${encodeURIComponent(JSON.stringify([query]))}`)
			)
			.map((exact) => {
				const members = uniqueMembers(exact);
				const sameAlias = members.filter(
					(member) => (member.alias ?? '').toLowerCase() === query.toLowerCase()
				);
				return {
					members: (sameAlias.length > 0 ? sameAlias : members.slice(0, 1)).slice(0, MAX_RESULTS),
					stats: exact.leaderboardStats ?? []
				};
			});
	}

	/**
	 * Players by name (Relic), with Steam avatar, total games and like score.
	 * `requireMatches` keeps only Steam players who have played at least one game.
	 */
	search(query: string, requireMatches: boolean): Task<PlayerSearchItem[]> {
		const q = query.trim();
		return ensure(q, badRequest('q is required'))
			.andThen(() => ensure(q.length <= 64, badRequest('q is too long')))
			.asyncAndThen(() =>
				cached(`players:search:${q.toLowerCase()}`, 30, () => this.searchRelic(q))
			)
			.andThen(({ members, stats }) => {
				const steamIds = members.map((member) => steamIdFromRelicName(member.name));
				return ResultAsync.combine([
					this.steam.playerSummaries(steamIds.filter(Boolean)),
					this.services.playerInfo.likeCounts(steamIds)
				]).map(([summaries, likes]) =>
					members
						.map((member, i): PlayerSearchItem => {
							const steamId = steamIds[i];
							const matchCount = stats
								.filter((stat) => stat.statgroup_id === member.personal_statgroup_id)
								.reduce(
									(total, stat) => total + (Number(stat.wins) || 0) + (Number(stat.losses) || 0),
									0
								);
							const item: PlayerSearchItem = {
								profileId: Number(member.profile_id) || 0,
								alias: member.alias ?? '',
								country: member.country ?? null,
								level: Number(member.level) || 0,
								steamId,
								avatarUrl: avatarOf(summaries.get(steamId)),
								matchCount
							};
							if (likes.has(steamId)) {
								item.likeCount = likes.get(steamId);
							}

							return item;
						})
						.filter((item) => item.profileId > 0)
						.filter((item) => !requireMatches || (item.matchCount > 0 && Boolean(item.steamId)))
				);
			});
	}
}
