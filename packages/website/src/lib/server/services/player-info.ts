import { isValidSteamId, toEloMap, type EloMap } from '../domain/ratings';
import { chunk, fromPb, sequence, type Task } from '../result';
import { Service } from './service';

export type PlayerLabel = { id: string; name: string; color: string; sort: number };

/** Chunk size for `steamId = a || steamId = b ...` filters (PocketBase caps expressions per filter). */
const CHUNK = 100;

/**
 * Per-Steam-id facts shown next to players everywhere (leaderboard, player page,
 * match detail): staff labels, community like score, stored ELO.
 */
export class PlayerInfoService extends Service {
	private bySteamIds<T>(
		collection: string,
		steamIds: string[],
		options: { fields?: string; expand?: string }
	): Task<T[]> {
		const ids = [...new Set(steamIds.filter(isValidSteamId))];
		const chunks = chunk(ids, CHUNK).map((part) =>
			part.map((steamId) => this.pb.filter('steamId = {:steamId}', { steamId })).join(' || ')
		);
		return sequence(chunks, (filter) =>
			fromPb(
				this.pb.collection(collection).getFullList<T>({ filter, ...options }),
				`Could not load ${collection}`
			)
		).map((pages) => pages.flat());
	}

	labels(steamIds: string[]): Task<Map<string, PlayerLabel[]>> {
		type Row = {
			steamId: string;
			expand?: { label?: { id: string; name: string; color: string; sort: number } };
		};
		return this.bySteamIds<Row>('player_label_assignments', steamIds, {
			expand: 'label',
			fields: 'steamId,expand.label.id,expand.label.name,expand.label.color,expand.label.sort'
		}).map((rows) => {
			const result = new Map<string, PlayerLabel[]>();
			for (const row of rows) {
				const label = row.expand?.label;
				if (!label) {
					continue;
				}

				const list = result.get(row.steamId) ?? [];
				list.push({
					id: label.id,
					name: label.name ?? '',
					color: label.color || '#F8C630',
					sort: Number(label.sort ?? 0)
				});
				result.set(row.steamId, list);
			}
			for (const list of result.values()) {
				list.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
			}
			return result;
		});
	}

	likeCounts(steamIds: string[]): Task<Map<string, number>> {
		return this.bySteamIds<{ steamId: string; likeCount: number }>('player_vote_scores', steamIds, {
			fields: 'steamId,likeCount'
		}).map((rows) => new Map(rows.map((row) => [row.steamId, Number(row.likeCount) || 0])));
	}

	/** Stored rating rows: Relic profile id and ELO per Steam id. */
	ratings(steamIds: string[]): Task<Map<string, { profileId: number; elo: EloMap }>> {
		return this.bySteamIds<{ steamId: string; profileId: number; elo: unknown }>(
			'player_ratings',
			steamIds,
			{ fields: 'steamId,profileId,elo' }
		).map(
			(rows) =>
				new Map(
					rows.map((row) => [
						row.steamId,
						{ profileId: Number(row.profileId) || 0, elo: toEloMap(row.elo) }
					])
				)
		);
	}

	/** Stored ELO per Steam id (players without any rating are left out). */
	elo(steamIds: string[]): Task<Map<string, EloMap>> {
		return this.ratings(steamIds).map((ratings) => {
			const result = new Map<string, EloMap>();
			for (const [steamId, rating] of ratings) {
				if (Object.keys(rating.elo).length > 0) {
					result.set(steamId, rating.elo);
				}
			}
			return result;
		});
	}
}
