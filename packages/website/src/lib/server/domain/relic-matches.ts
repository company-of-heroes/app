/**
 * Relic `getRecentMatchHistoryByProfileId` responses -> match objects for the
 * player page. Pure functions; the players service does the fetching.
 */
import type { LeaderboardStat, PlayerLabel } from '@company-of-heroes/ui/player/types';
import { asList, steamIdFromRelicName } from './ratings';

type RelicMatchProfile = {
	profile_id: number;
	name?: string;
	alias: string;
	personal_statgroup_id?: number;
	xp?: number;
	level?: number;
	leaderboardregion_id?: number;
	country?: string;
};
type RelicReportResult = {
	profile_id: number;
	resulttype?: number;
	teamid: number;
	race_id: number;
	xpgained?: number;
	counters?: string;
	matchstartdate?: number;
};
type RelicMember = {
	profile_id: number;
	statgroup_id?: number;
	wins: number;
	losses: number;
	streak: number;
	arbitration?: number;
	outcome: number;
	oldrating: number;
	newrating: number;
	reporttype?: number;
};
type RelicMatch = {
	id: number;
	creator_profile_id?: number;
	mapname: string;
	maxplayers?: number;
	matchtype_id: number;
	options?: string;
	slotinfo?: string;
	description?: string;
	startgametime: number;
	completiontime: number;
	observertotal?: number;
	matchhistoryreportresults?: unknown;
	matchhistorymember?: unknown;
};
export type RelicMatchHistory = { matchHistoryStats?: unknown; profiles?: unknown };

export type { LeaderboardStat };

export type HistoryMatchPlayer = RelicMatchProfile &
	Omit<RelicReportResult, 'profile_id'> &
	Omit<RelicMember, 'profile_id'> & {
		steamId: string;
		ranklevel?: number;
		labels?: PlayerLabel[];
		likeCount?: number;
	};

export type HistoryMatch = Omit<RelicMatch, 'matchhistoryreportresults' | 'matchhistorymember'> & {
	players: HistoryMatchPlayer[];
	outcome: number;
	lobbyId?: string | null;
};

const byProfileId = <T extends { profile_id: number }>(items: T[]) =>
	new Map(
		items
			.filter((item) => Number(item?.profile_id) > 0)
			.map((item) => [Number(item.profile_id), item])
	);

/** Matches with at least one player who has both a profile and a report; `outcome` is the owner's. */
export function toHistoryMatches(data: RelicMatchHistory, ownerProfileId: number): HistoryMatch[] {
	const profiles = byProfileId(asList<RelicMatchProfile>(data.profiles));
	const matches: HistoryMatch[] = [];

	for (const match of asList<RelicMatch>(data.matchHistoryStats)) {
		const reports = byProfileId(asList<RelicReportResult>(match.matchhistoryreportresults));
		const players: HistoryMatchPlayer[] = [];
		for (const member of asList<RelicMember>(match.matchhistorymember)) {
			const profile = profiles.get(Number(member.profile_id));
			const report = reports.get(Number(member.profile_id));
			if (!profile || !report) {
				continue;
			}

			players.push({
				profile_id: profile.profile_id,
				name: profile.name,
				alias: profile.alias,
				personal_statgroup_id: profile.personal_statgroup_id,
				xp: profile.xp,
				level: profile.level,
				leaderboardregion_id: profile.leaderboardregion_id,
				country: profile.country,
				steamId: steamIdFromRelicName(profile.name),
				resulttype: report.resulttype,
				teamid: report.teamid,
				race_id: report.race_id,
				xpgained: report.xpgained,
				counters: report.counters,
				matchstartdate: report.matchstartdate,
				statgroup_id: member.statgroup_id,
				wins: member.wins,
				losses: member.losses,
				streak: member.streak,
				arbitration: member.arbitration,
				outcome: member.outcome,
				oldrating: member.oldrating,
				newrating: member.newrating,
				reporttype: member.reporttype
			});
		}
		if (players.length === 0) {
			continue;
		}

		matches.push({
			id: match.id,
			creator_profile_id: match.creator_profile_id,
			mapname: match.mapname,
			maxplayers: match.maxplayers,
			matchtype_id: match.matchtype_id,
			options: match.options,
			slotinfo: match.slotinfo,
			description: match.description,
			startgametime: match.startgametime,
			completiontime: match.completiontime,
			observertotal: match.observertotal,
			players,
			outcome: players.find((player) => Number(player.profile_id) === ownerProfileId)?.outcome ?? 0
		});
	}
	return matches;
}

/** Relic ladder for a match type and race: 1-4 automatch, 14 skirmish, 0 basic. */
export function leaderboardIdForMatchRace(matchTypeId: number, race: number): number | null {
	if (!Number.isInteger(race) || race < 0 || race > 3) {
		return null;
	}

	if (matchTypeId === 14) {
		return 42 + race;
	}

	if (!Number.isInteger(matchTypeId) || matchTypeId < 0 || matchTypeId > 4) {
		return null;
	}

	return matchTypeId * 4 + race;
}

/** Current rank level per player for ranked matches (automatch 1-4, skirmish 14); 0 otherwise. */
export function attachRankLevels(
	matches: HistoryMatch[],
	statsByProfileId: Map<number, LeaderboardStat[]>
): void {
	for (const match of matches) {
		const matchType = Number(match.matchtype_id);
		const ranked = (matchType >= 1 && matchType <= 4) || matchType === 14;
		for (const player of match.players) {
			const leaderboardId = ranked
				? leaderboardIdForMatchRace(matchType, Number(player.race_id))
				: null;
			const stat =
				leaderboardId === null
					? undefined
					: statsByProfileId
							.get(Number(player.profile_id))
							?.find((entry) => Number(entry.leaderboard_id) === leaderboardId);
			const level = Number(stat?.ranklevel);
			player.ranklevel = Number.isFinite(level) && level > 0 ? level : 0;
		}
	}
}

/** Staff hide keywords match whole words in the match title (case-insensitive). */
export function titleHasHiddenKeyword(title: string | undefined, keywords: string[]): boolean {
	const text = title ?? '';
	return keywords.some((word) => {
		const trimmed = word.trim();
		if (!text || !trimmed) {
			return false;
		}

		const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, 'i').test(text);
	});
}

/** Relic `getpersonalstat` response. */
export type RelicPersonalStat = {
	statGroups?: {
		members?: {
			profile_id: number;
			alias?: string;
			country?: string;
			level?: number;
			name?: string;
			personal_statgroup_id: number;
		}[];
	}[];
	leaderboardStats?: (LeaderboardStat & { statgroup_id: number })[];
};

export type RelicProfile = {
	profile_id: number;
	alias: string;
	country: string | null;
	level: number;
	name: string;
	leaderboardStats: LeaderboardStat[];
};

/** The member picked by `match`, with its own ladder stats (a response can hold several groups). */
export function profileFromPersonalStat(
	data: RelicPersonalStat,
	match: (member: { name?: string; profile_id: number }) => boolean
): RelicProfile | null {
	const member = data.statGroups?.[0]?.members?.find(match);
	if (!member) {
		return null;
	}

	return {
		profile_id: member.profile_id,
		alias: member.alias ?? '',
		country: member.country || null,
		level: member.level ?? 0,
		name: member.name ?? '',
		leaderboardStats: (data.leaderboardStats ?? []).filter(
			(stat) => stat.statgroup_id === member.personal_statgroup_id
		)
	};
}
