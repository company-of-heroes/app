import { ok, okAsync } from 'neverthrow';
import { RELIC_BASE } from '../clients/relic';
import { profileFromPersonalStat, type RelicPersonalStat } from '../domain/relic-matches';
import { steamIdsOf, type UserRow } from '../domain/users';
import { fromPb, sequence, type Task } from '../result';
import { Service } from './service';

export const STREAMER_THRESHOLD_MS = 12 * 60 * 60 * 1000;
export const STREAMER_LABEL_NAME = 'Streamer';
const STREAMER_LABEL_COLOR = '#9146FF';
/** One report never counts for more than this, whatever the client claims. */
const MAX_REPORT_MS = 5 * 60 * 1000;
/** Clock slack between two reports. */
const REPORT_SLACK_MS = 30 * 1000;

type ProgressRow = {
	id: string;
	user: string;
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
 * Lifetime CoH streaming time per account. The desktop reports small deltas while
 * it is live (Twitch or YouTube) with the game running; at 12 hours every Steam id
 * on the account gets the Streamer label.
 */
export class StreamingService extends Service {
	private get rows() {
		return this.pb.collection('streaming_progress');
	}

	private find(userId: string): Task<ProgressRow | null> {
		return fromPb(
			this.rows.getList<ProgressRow>(1, 1, {
				filter: this.pb.filter('user = {:userId}', { userId }),
				skipTotal: true
			}),
			'Could not load streaming progress'
		).map((found) => found.items[0] ?? null);
	}

	progress(userId: string): Task<StreamingProgress> {
		return this.find(userId).map(toProgress);
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

	/** Steam ids of the account that already carry the label. */
	private assigned(labelId: string, steamIds: string[]): Task<{ steamId: string }[]> {
		return fromPb(
			this.pb.collection('player_label_assignments').getFullList<{ steamId: string }>({
				filter: [
					this.pb.filter('label = {:labelId}', { labelId }),
					`(${steamIds.map((steamId) => this.pb.filter('steamId = {:steamId}', { steamId })).join(' || ')})`
				].join(' && '),
				fields: 'steamId'
			}),
			'Could not load labels'
		);
	}

	/** Labels the Steam ids Relic knows; returns how many were labelled. */
	private assign(labelId: string, missing: string[]): Task<number> {
		return this.relicProfiles(missing).andThen((profiles) => {
			const known = missing
				.map((steamId, i) => ({ steamId, profile: profiles[i] }))
				.filter(({ profile }) => profile?.profile_id);
			return sequence(known, ({ steamId, profile }) =>
				fromPb(
					this.pb.collection('player_label_assignments').create({
						steamId,
						profileId: profile!.profile_id,
						alias: profile!.alias || undefined,
						label: labelId
					}),
					'Could not assign the Streamer label'
				)
			).map((created) => created.length);
		});
	}

	/** Labels every Steam id on the account; returns false while none could be labelled yet. */
	grantStreamerLabel(userId: string): Task<boolean> {
		return fromPb(
			this.pb.collection('users').getOne<UserRow>(userId, { fields: 'steamIds' }),
			'User not found'
		).andThen((user) => {
			const steamIds = steamIdsOf(user);
			if (steamIds.length === 0) {
				return okAsync(false);
			}

			return this.streamerLabelId().andThen((labelId) =>
				this.assigned(labelId, steamIds).andThen((assigned) => {
					const missing = steamIds.filter((id) => !assigned.some((row) => row.steamId === id));
					if (missing.length === 0) {
						return okAsync(true);
					}

					return this.assign(labelId, missing).map(
						(labelled) => assigned.length > 0 || labelled > 0
					);
				})
			);
		});
	}

	/** Grants the label once the threshold is crossed; a failure is logged and retried on the next report. */
	private badgeFor(userId: string, existing: ProgressRow | null, streamedMs: number) {
		const granted = Boolean(existing?.badgeGranted);
		if (granted || streamedMs < STREAMER_THRESHOLD_MS) {
			return okAsync({ granted, changed: false });
		}

		return this.grantStreamerLabel(userId)
			.orElse((error) => {
				console.warn('[streaming] grant label', userId, error);
				return ok(false);
			})
			.map((granted) => ({ granted, changed: true }));
	}

	report(userId: string, input: StreamingReport): Task<StreamingProgress & { creditedMs: number }> {
		const now = Date.now();
		return this.find(userId).andThen((existing) => {
			const lastReportAt = existing?.lastReportAt ? Date.parse(existing.lastReportAt) : NaN;
			const sinceLast = Number.isFinite(lastReportAt)
				? Math.max(0, now - lastReportAt + REPORT_SLACK_MS)
				: MAX_REPORT_MS;
			const delta = Math.floor(Math.min(Math.max(0, input.deltaMs), MAX_REPORT_MS, sinceLast));
			const streamedMs = Number(existing?.streamedMs ?? 0) + delta;
			const body: Record<string, unknown> = {
				streamedMs,
				lastReportAt: new Date(now).toISOString()
			};
			if (input.twitchLogin) {
				body.twitchLogin = input.twitchLogin;
			}

			if (input.youtubeChannelId) {
				body.youtubeChannelId = input.youtubeChannelId;
			}

			return this.badgeFor(userId, existing, streamedMs)
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
				.map((row) => ({ ...toProgress(row), creditedMs: delta }));
		});
	}
}
