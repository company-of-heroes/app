import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type { RecordModel } from 'pocketbase';
import type { RewardCondition } from '@company-of-heroes/ui/reward/metrics';
import type { PlayerRewards } from '@company-of-heroes/ui/reward/types';
import { normalizeBaseUrl, sendV1, type ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import { fromPbPromise, pbOptions, requireAuth } from '../pb';
import { STEAM_ID_REGEX } from '../ratings/ratings';
import { toUploadFile, type ToUploadFileOptions } from '../upload-file';
import { parseRewardConditions, rewardConditionsSchema } from './schema';

export const REWARD_IMAGE_MAX_BYTES = 256 * 1024;
export const REWARD_IMAGE_SIZE = 150;

export const REWARD_IMAGE_UPLOAD: ToUploadFileOptions = {
	maxBytes: REWARD_IMAGE_MAX_BYTES,
	allowed: ['png', 'jpeg', 'webp'],
	fallbackName: 'reward.png',
	tooLargeMessage: 'Image must be 256 KB or smaller.',
	invalidTypeMessage: 'Image must be a png, jpeg, or webp file.'
};

/** A reward as admins edit it. */
export type RewardRecord = RecordModel & {
	title: string;
	description: string;
	image: string;
	conditions: RewardCondition[] | null;
	enabled: boolean;
	secret: boolean;
	sort: number;
};

export type RewardInput = {
	title: string;
	description: string;
	conditions: RewardCondition[];
	enabled: boolean;
	secret: boolean;
	sort: number;
};

/** 150x150 thumb of a reward image, cache-busted by the record's `updated`. */
export function rewardImageUrl(
	pb: ApiDeps['pocketbase'],
	record: RecordModel,
	baseUrl?: string
): string | null {
	const filename = String(record.image ?? '').trim();
	if (!filename) {
		return null;
	}

	let url = pb.files.getURL(record, filename, {
		thumb: `${REWARD_IMAGE_SIZE}x${REWARD_IMAGE_SIZE}`
	});
	if (baseUrl && url.startsWith('/')) {
		url = `${normalizeBaseUrl(baseUrl)}${url}`;
	}

	if (record.updated) {
		const separator = url.includes('?') ? '&' : '?';
		url += `${separator}v=${encodeURIComponent(String(record.updated))}`;
	}

	return url;
}

export class RewardsApi {
	constructor(private deps: ApiDeps) {}

	/** Unlocked rewards of a player; the owner also gets locked ones with progress. */
	forPlayer(steamId: string): ResultAsync<PlayerRewards, ApiError> {
		const id = steamId.trim();
		if (!STEAM_ID_REGEX.test(id)) {
			return errAsync(apiError(400, 'Enter a valid Steam ID64.'));
		}

		return fromPbPromise(
			sendV1<PlayerRewards>(this.deps, `/rewards/players/${encodeURIComponent(id)}`),
			'Failed to load rewards.'
		);
	}

	/** The signed-in user's rewards with progress. */
	mine(): ResultAsync<PlayerRewards, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return fromPbPromise(
			sendV1<PlayerRewards>(this.deps, '/rewards/me'),
			'Failed to load rewards.'
		);
	}

	/** Admin: every reward, disabled ones included. */
	listAll(): ResultAsync<RewardRecord[], ApiError> {
		return fromPbPromise(
			this.deps.pocketbase
				.collection('rewards')
				.getFullList<RewardRecord>(pbOptions(this.deps, { sort: 'sort,title' })),
			'Failed to load rewards.'
		).map((records) =>
			records.map((record) => ({ ...record, conditions: parseRewardConditions(record.conditions) }))
		);
	}

	imageUrl(record: RecordModel): string | null {
		return rewardImageUrl(this.deps.pocketbase, record, this.deps.baseUrl);
	}

	/** Admin: `image` is required on create. */
	create(input: RewardInput, image: File): ResultAsync<RewardRecord, ApiError> {
		return this.#body(input, image).andThen((body) =>
			fromPbPromise(
				this.deps.pocketbase.collection('rewards').create<RewardRecord>(body, pbOptions(this.deps)),
				'Failed to create the reward.'
			)
		);
	}

	/** Admin: leave `image` null to keep the current one. */
	update(id: string, input: RewardInput, image: File | null): ResultAsync<RewardRecord, ApiError> {
		return this.#body(input, image).andThen((body) =>
			fromPbPromise(
				this.deps.pocketbase
					.collection('rewards')
					.update<RewardRecord>(id, body, pbOptions(this.deps)),
				'Failed to save the reward.'
			)
		);
	}

	/** Admin: also removes every unlock of the reward. */
	remove(id: string): ResultAsync<void, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('rewards').delete(id, pbOptions(this.deps)),
			'Failed to delete the reward.'
		).map(() => undefined);
	}

	#body(input: RewardInput, image: File | null): ResultAsync<Record<string, unknown>, ApiError> {
		const title = input.title.trim();
		if (!title || title.length > 80) {
			return errAsync(apiError(400, 'Title must be between 1 and 80 characters.'));
		}

		const description = input.description.trim();
		if (description.length > 300) {
			return errAsync(apiError(400, 'Description must be 300 characters or fewer.'));
		}

		const conditions = rewardConditionsSchema.safeParse(input.conditions);
		if (!conditions.success) {
			return errAsync(apiError(400, 'Check the conditions and try again.'));
		}

		const body: Record<string, unknown> = {
			title,
			description,
			conditions: conditions.data,
			enabled: input.enabled,
			secret: input.secret,
			sort: Math.max(0, Math.round(input.sort))
		};
		const file = image ? toUploadFile(image, REWARD_IMAGE_UPLOAD) : okAsync(null);
		return file.map((upload) => (upload ? { ...body, image: upload } : body));
	}
}
