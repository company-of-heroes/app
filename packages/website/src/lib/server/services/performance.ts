import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { cached } from '../cache';
import { unauthorized } from '../errors';
import { fromPb, type Task } from '../result';
import {
	summarizePerformance,
	type PerformanceRow,
	type PlayerPerformance
} from '../domain/performance';
import { Service } from './service';

const CACHE_SECONDS = 600;
const ROW_FIELDS = 'id,lobby,session_id,map,outcome,race_id,matchtype_id';

export class PerformanceService extends Service {
	private rowsFor(identity: string): Task<PerformanceRow[]> {
		return ResultAsync.combine([
			fromPb(
				this.pb.collection('lobby_player_index').getFullList<PerformanceRow>({
					// `counts` = finished and not Skirmish
					filter: `(${identity}) && counts = true && session_id > 0 && (outcome = 0 || outcome = 1)`,
					fields: ROW_FIELDS,
					batch: 1000
				}),
				'Could not load performance'
			),
			this.services.hiddenMatches.lobbyIds()
		]).map(([rows, hiddenIds]) => rows.filter((row) => !hiddenIds.has(row.lobby)));
	}

	/** A Relic profile's record across all indexed games. */
	ofProfile(profileId: number): Task<PlayerPerformance> {
		return cached(`performance:profile:${profileId}`, CACHE_SECONDS, () =>
			this.rowsFor(this.pb.filter('profile_id = {:profileId}', { profileId })).map(
				summarizePerformance
			)
		);
	}

	/**
	 * The signed-in user's record: their Steam accounts, plus `profileId` when it
	 * belongs to one of them (or the account has no Steam ids linked yet).
	 */
	private ofUser(userId: string, profileId: number): Task<PlayerPerformance> {
		return cached(`performance:user:${userId}:${profileId}`, CACHE_SECONDS, () =>
			fromPb(
				this.pb.collection('users').getOne<{ steamIds: unknown }>(userId, { fields: 'steamIds' }),
				'User not found'
			)
				.andThen((user) => {
					const steamIds = Array.isArray(user.steamIds) ? user.steamIds.map(String) : [];
					return this.profileBelongsTo(profileId, steamIds).map((profileIsMine) => [
						...steamIds.map((steamId) => this.pb.filter('steam_id = {:steamId}', { steamId })),
						...(profileIsMine ? [this.pb.filter('profile_id = {:profileId}', { profileId })] : [])
					]);
				})
				.andThen((identity) =>
					identity.length > 0 ? this.rowsFor(identity.join(' || ')) : okAsync([])
				)
				.map(summarizePerformance)
		);
	}

	/** Whether the profile's stored Steam id is one of these (any profile counts without Steam ids). */
	private profileBelongsTo(profileId: number, steamIds: string[]): Task<boolean> {
		if (steamIds.length === 0) {
			return okAsync(true);
		}

		return fromPb(
			this.pb.collection('player_ratings').getList<{ steamId: string }>(1, 1, {
				filter: this.pb.filter('profileId = {:profileId}', { profileId }),
				fields: 'steamId',
				skipTotal: true
			}),
			'Could not load ratings'
		).map((rating) => steamIds.includes(rating.items[0]?.steamId ?? ''));
	}

	get(
		scope: 'user' | 'community',
		profileId: number,
		userId: string | null
	): Task<PlayerPerformance> {
		if (scope === 'community') {
			return this.ofProfile(profileId);
		}

		if (!userId) {
			return errAsync(unauthorized('Sign in to see your performance'));
		}

		return this.ofUser(userId, profileId);
	}
}
