import { errAsync, ok, okAsync } from 'neverthrow';
import { cached } from '../cache';
import { RELIC_BASE } from '../clients/relic';
import { profileFromPersonalStat, type RelicPersonalStat } from '../domain/relic-matches';
import { steamIdsOf, type UserRow } from '../domain/users';
import { badRequest, forbidden } from '../errors';
import { fromPb, type Task } from '../result';
import { Service } from './service';

export const STREAMER_THRESHOLD_MS = 12 * 60 * 60 * 1000;
export const STREAMER_LABEL_NAME = 'Streamer';
const STREAMER_LABEL_COLOR = '#9146FF';
/** One report never counts for more than this, whatever the client claims. */
const MAX_REPORT_MS = 5 * 60 * 1000;
/** Clock slack between two reports. */
const REPORT_SLACK_MS = 30 * 1000;
/** Desktop reports every ~60s while live; two missed reports and the stream counts as ended. */
const LIVE_WINDOW_MS = 150 * 1000;
const LIVE_CACHE_SECONDS = 30;

type ProgressRow = {
	id: string;
	user: string;
	/** Empty on rows from before progress was per Steam account. */
	steamId: string;
	streamedMs: number;
	lastReportAt: string;
	twitchLogin: string;
	youtubeChannelId: string;
	badgeGranted: boolean;
};

export type StreamingProgress = {
	streamedMs: number;
	thresholdMs: number;
	badgeGranted: boolean;
};

export type StreamingReport = {
	deltaMs: number;
	/** The Steam account playing; optional only for old desktop versions. */
	steamId?: string | null;
	twitchLogin?: string | null;
	youtubeChannelId?: string | null;
};

function toProgress(
	row: Pick<ProgressRow, 'streamedMs' | 'badgeGranted'> | null
): StreamingProgress {
	return {
		streamedMs: Number(row?.streamedMs ?? 0),
		thresholdMs: STREAMER_THRESHOLD_MS,
		badgeGranted: Boolean(row?.badgeGranted)
	};
}
/**
 * Lifetime CoH streaming time per Steam account. The desktop reports small deltas while
 * it is live (Twitch or YouTube) with the game running; at 12 hours that Steam id gets
 * the Streamer label. Other Steam ids on the same account earn it separately.
 */
export class StreamingService extends Service {
	private get rows() {
		return this.pb.collection('streaming_progress');
	}

	/**
	 * The Steam id the time counts for: the one asked for (it must be on the account), or
	 * the only one when an old desktop sends none. Null when that is ambiguous.
	 */
	private steamIdFor(userId: string, requested?: string | null): Task<string | null> {
		return fromPb(
			this.pb.collection('users').getOne<UserRow>(userId, { fields: 'steamIds' }),
			'User not found'
		).andThen((user) => {
			const steamIds = steamIdsOf(user);
			if (requested) {
				return steamIds.includes(requested)
					? okAsync(requested)
					: errAsync(forbidden('That Steam account is not linked to your account.'));
			}

			return okAsync(steamIds.length === 1 ? steamIds[0] : null);
		});
	}

	/** The Steam id's row, else the account's row from before per-Steam progress (claimed on report). */
	private find(userId: string, steamId: string): Task<ProgressRow | null> {
		return fromPb(
			this.rows.getList<ProgressRow>(1, 2, {
				filter: this.pb.filter("user = {:userId} && (steamId = {:steamId} || steamId = '')", {
					userId,
					steamId
				}),
				skipTotal: true
			}),
			'Could not load streaming progress'
		).map(
			(found) =>
				found.items.find((row) => row.steamId === steamId) ??
				found.items.find((row) => !row.steamId) ??
				null
		);
	}

	/**
	 * Steam ids streaming right now: the desktop reports about every minute while live
	 * with the game running, so a recent report means live.
	 */
	liveSteamIds(): Task<string[]> {
		return cached('streaming:live', LIVE_CACHE_SECONDS, () =>
			fromPb(
				this.rows.getFullList<{ steamId: string }>({
					filter: this.pb.filter("lastReportAt >= {:since} && steamId != ''", {
						since: new Date(Date.now() - LIVE_WINDOW_MS)
					}),
					fields: 'steamId'
				}),
				'Could not load live streamers'
			).map((rows) => [...new Set(rows.map((row) => row.steamId))])
		);
	}

	progress(userId: string, requestedSteamId?: string | null): Task<StreamingProgress> {
		return this.steamIdFor(userId, requestedSteamId).andThen((steamId) => {
			if (!steamId) {
				return okAsync(toProgress(null));
			}

			return this.find(userId, steamId).andThen((row) =>
				(row?.badgeGranted && row.steamId === steamId
					? this.healLabel(steamId)
					: okAsync(false)
				).map(() => toProgress(row))
			);
		});
	}

	private streamerLabelId(): Task<string> {
		const labels = this.pb.collection('user_labels');
		return fromPb(
			labels.getList<{ id: string }>(1, 1, {
				filter: this.pb.filter('name = {:name}', { name: STREAMER_LABEL_NAME }),
				fields: 'id',
				skipTotal: true
			}),
			'Could not load labels'
		).andThen((existing) =>
			existing.items[0]
				? okAsync(existing.items[0].id)
				: fromPb(
						labels.create<{ id: string }>({
							name: STREAMER_LABEL_NAME,
							color: STREAMER_LABEL_COLOR,
							sort: 0
						}),
						'Could not create the Streamer label'
					).map((created) => created.id)
		);
	}

	private relicProfiles(steamIds: string[]) {
		const urls = steamIds.map(
			(steamId) =>
				`${RELIC_BASE}/community/leaderboard/getpersonalstat?title=coh1&profile_names=${encodeURIComponent(JSON.stringify([`/steam/${steamId}`]))}`
		);
		return this.relic.getMany<RelicPersonalStat>(urls).map((results) =>
			steamIds.map((steamId, i) => {
				const result = results[i];
				return result?.ok
					? profileFromPersonalStat(result.body, (member) => member.name === `/steam/${steamId}`)
					: null;
			})
		);
	}

	private hasLabel(labelId: string, steamId: string): Task<boolean> {
		return fromPb(
			this.pb.collection('player_label_assignments').getList(1, 1, {
				filter: this.pb.filter('label = {:labelId} && steamId = {:steamId}', {
					labelId,
					steamId
				}),
				fields: 'id',
				skipTotal: true
			}),
			'Could not load labels'
		).map((found) => found.items.length > 0);
	}

	/** Labels the Steam id; returns false while Relic does not know it yet. */
	grantStreamerLabel(steamId: string): Task<boolean> {
		return this.streamerLabelId().andThen((labelId) =>
			this.hasLabel(labelId, steamId).andThen((labelled) => {
				if (labelled) {
					return okAsync(true);
				}

				return this.relicProfiles([steamId]).andThen(([profile]) => {
					if (!profile?.profile_id) {
						return okAsync(false);
					}

					return fromPb(
						this.pb.collection('player_label_assignments').create({
							steamId,
							profileId: profile.profile_id,
							alias: profile.alias || undefined,
							label: labelId
						}),
						'Could not assign the Streamer label'
					).map(() => true);
				});
			})
		);
	}

	/**
	 * Re-labels a Steam id that already earned the badge (Relic may not have known it yet,
	 * or staff removed the label by accident). A failure is logged, never surfaced.
	 */
	private healLabel(steamId: string): Task<boolean> {
		return this.grantStreamerLabel(steamId).orElse((error) => {
			console.warn('[streaming] grant label', steamId, error);
			return ok(false);
		});
	}

	/** Grants the label once the threshold is crossed; a failure is retried on the next report. */
	private badgeFor(steamId: string, existing: ProgressRow | null, streamedMs: number) {
		if (existing?.badgeGranted) {
			return this.healLabel(steamId).map(() => ({ granted: true, changed: false }));
		}

		if (streamedMs < STREAMER_THRESHOLD_MS) {
			return okAsync({ granted: false, changed: false });
		}

		return this.healLabel(steamId).map((granted) => ({ granted, changed: true }));
	}

	report(userId: string, input: StreamingReport): Task<StreamingProgress & { creditedMs: number }> {
		return this.steamIdFor(userId, input.steamId).andThen((steamId) =>
			steamId
				? this.reportFor(userId, steamId, input)
				: errAsync(badRequest('Update the app to keep earning the Streamer badge.'))
		);
	}

	private reportFor(
		userId: string,
		steamId: string,
		input: StreamingReport
	): Task<StreamingProgress & { creditedMs: number }> {
		const now = Date.now();
		return this.find(userId, steamId).andThen((existing) => {
			const lastReportAt = existing?.lastReportAt ? Date.parse(existing.lastReportAt) : NaN;
			const sinceLast = Number.isFinite(lastReportAt)
				? Math.max(0, now - lastReportAt + REPORT_SLACK_MS)
				: MAX_REPORT_MS;
			const delta = Math.floor(Math.min(Math.max(0, input.deltaMs), MAX_REPORT_MS, sinceLast));
			const streamedMs = Number(existing?.streamedMs ?? 0) + delta;
			const body: Record<string, unknown> = {
				steamId,
				streamedMs,
				lastReportAt: new Date(now).toISOString()
			};
			if (input.twitchLogin) {
				body.twitchLogin = input.twitchLogin;
			}

			if (input.youtubeChannelId) {
				body.youtubeChannelId = input.youtubeChannelId;
			}

			return this.badgeFor(steamId, existing, streamedMs)
				.andThen((badge) => {
					if (badge.changed) {
						body.badgeGranted = badge.granted;
					}

					return fromPb(
						existing
							? this.rows.update<ProgressRow>(existing.id, body)
							: this.rows.create<ProgressRow>({ user: userId, ...body }),
						'Could not save streaming progress'
					);
				})
				.andThen((row) => {
					// "Hours streamed" rewards: queue a check each time a whole hour completes.
					const hour = 60 * 60 * 1000;
					const newHour =
						Math.floor(Number(existing?.streamedMs ?? 0) / hour) !== Math.floor(streamedMs / hour);
					return (
						newHour ? this.services.rewards.markDirty([{ id: userId }]) : okAsync(undefined)
					).map(() => row);
				})
				.map((row) => ({ ...toProgress(row), creditedMs: delta }));
		});
	}
}
