import { okAsync } from 'neverthrow';
import { RELIC_BASE } from '../clients/relic';
import { isValidSteamId, steamIdFromRelicName } from '../domain/ratings';
import { profileFromPersonalStat, type RelicPersonalStat } from '../domain/relic-matches';
import { all, chunk, fromPb, sequence, type Task } from '../result';
import { Service } from './service';

/** Automatch 1v1 (4–7) and 2v2 (8–11), one ladder per faction. */
const LADDER_IDS = [4, 5, 6, 7, 8, 9, 10, 11];
const TOP_RANK = 20;
/** Rank 20 on this many of those ladders earns an `autoRank20` label. */
const LADDERS_NEEDED = 2;
/** `steamId = a || …` per filter (PocketBase caps expressions per filter). */
const CHUNK = 100;

type Candidate = { steamId: string; profileId: number; alias: string };

type LadderStat = { leaderboard_id: number; ranklevel: number; highestranklevel?: number };

/** Rank 20 now or ever, on two of the 1v1/2v2 ladders. */
function qualifies(stats: LadderStat[]): boolean {
	const ladders = new Set(
		stats
			.filter((stat) => LADDER_IDS.includes(Number(stat.leaderboard_id)))
			.filter(
				(stat) =>
					Math.max(Number(stat.ranklevel) || 0, Number(stat.highestranklevel) || 0) >= TOP_RANK
			)
			.map((stat) => Number(stat.leaderboard_id))
	);
	return ladders.size >= LADDERS_NEEDED;
}

/**
 * Labels staff marked `autoRank20` (Veteran) go to every Steam ID with rank 20 on two of
 * the 1v1/2v2 ladders, in any mix of mode and faction. The job reads the ladders for every
 * player; linked accounts are also checked on their highest rank ever (rewards evaluate).
 * An assignment is never taken back; staff can still remove it by hand.
 */
export class LabelAutoService extends Service {
	private autoLabelIds(): Task<string[]> {
		return fromPb(
			this.pb.collection('user_labels').getFullList<{ id: string }>({
				filter: 'autoRank20 = true',
				fields: 'id'
			}),
			'Could not load labels'
		).map((rows) => rows.map((row) => row.id));
	}

	/** `label:steamId` pairs that already exist. */
	private assigned(labelIds: string[], steamIds: string[]): Task<Set<string>> {
		const labels = labelIds.map((id) => this.pb.filter('label = {:id}', { id })).join(' || ');
		return sequence(chunk(steamIds, CHUNK), (part) =>
			fromPb(
				this.pb.collection('player_label_assignments').getFullList<{
					steamId: string;
					label: string;
				}>({
					filter: `(${labels}) && (${part.map((steamId) => this.pb.filter('steamId = {:steamId}', { steamId })).join(' || ')})`,
					fields: 'steamId,label'
				}),
				'Could not load labels'
			)
		).map((pages) => new Set(pages.flat().map((row) => `${row.label}:${row.steamId}`)));
	}

	/** Assigns every auto label the candidates do not have yet; returns how many were new. */
	private grant(labelIds: string[], candidates: Candidate[]): Task<number> {
		if (labelIds.length === 0 || candidates.length === 0) {
			return okAsync(0);
		}

		return this.assigned(
			labelIds,
			candidates.map((candidate) => candidate.steamId)
		).andThen((have) => {
			const missing = candidates.flatMap((candidate) =>
				labelIds
					.filter((labelId) => !have.has(`${labelId}:${candidate.steamId}`))
					.map((labelId) => ({ candidate, labelId }))
			);
			return sequence(missing, ({ candidate, labelId }) =>
				fromPb(
					this.pb.collection('player_label_assignments').create({
						steamId: candidate.steamId,
						profileId: candidate.profileId,
						alias: candidate.alias || undefined,
						label: labelId
					}),
					'Could not assign label'
				)
			).map((created) => created.length);
		});
	}

	/** Job: every player on the 1v1/2v2 ladders with rank 20 on two of them. */
	run(): Task<{ processed: number; more: boolean }> {
		return this.autoLabelIds().andThen((labelIds) => {
			if (labelIds.length === 0) {
				return okAsync({ processed: 0, more: false });
			}

			return all(LADDER_IDS.map((id) => this.services.leaderboard.get(id))).andThen((boards) => {
				const stats = new Map<string, { candidate: Candidate; stats: LadderStat[] }>();
				for (const stat of boards.flatMap((board) => board.stats)) {
					const steamId = steamIdFromRelicName(stat.profile.name);
					if (!isValidSteamId(steamId) || stat.profile.profile_id <= 0) {
						continue;
					}

					const entry = stats.get(steamId) ?? {
						candidate: { steamId, profileId: stat.profile.profile_id, alias: stat.profile.alias },
						stats: []
					};
					entry.stats.push(stat);
					stats.set(steamId, entry);
				}

				const candidates = [...stats.values()]
					.filter((entry) => qualifies(entry.stats))
					.map((entry) => entry.candidate);
				return this.grant(labelIds, candidates).map((processed) => ({ processed, more: false }));
			});
		});
	}

	/** Linked Steam IDs, on their highest rank ever (a ladder only shows the current one). */
	grantForSteamIds(steamIds: string[]): Task<number> {
		const ids = steamIds.filter(isValidSteamId);
		if (ids.length === 0) {
			return okAsync(0);
		}

		return this.autoLabelIds().andThen((labelIds) => {
			if (labelIds.length === 0) {
				return okAsync(0);
			}

			const urls = ids.map(
				(steamId) =>
					`${RELIC_BASE}/community/leaderboard/getpersonalstat?title=coh1&profile_names=${encodeURIComponent(JSON.stringify([`/steam/${steamId}`]))}`
			);
			return this.relic.getMany<RelicPersonalStat>(urls).andThen((results) => {
				const candidates = ids.flatMap((steamId, i) => {
					const result = results[i];
					const profile = result?.ok
						? profileFromPersonalStat(result.body, (member) => member.name === `/steam/${steamId}`)
						: null;
					if (!profile?.profile_id || !qualifies(profile.leaderboardStats)) {
						return [];
					}

					return [{ steamId, profileId: profile.profile_id, alias: profile.alias }];
				});
				return this.grant(labelIds, candidates);
			});
		});
	}
}
