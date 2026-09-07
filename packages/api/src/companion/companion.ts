import type { RecordModel } from 'pocketbase';
import { okAsync, ResultAsync } from 'neverthrow';
import { z } from 'zod';
import type { ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import { escapePocketBaseString, pbOptions } from '../pb';
import { readMetaVersion } from './meta';

export { readMetaVersion } from './meta';

const companionUserSchema = z
	.object({
		id: z.string(),
		email: z.string().optional(),
		name: z.string().optional(),
		avatar: z.string().optional(),
		role: z.string().optional(),
		steamIds: z.array(z.union([z.string(), z.number()])).optional(),
		meta: z.unknown().optional(),
		lastLogin: z.string().optional(),
		created: z.string().optional(),
		updated: z.string().optional(),
		collectionId: z.string().optional(),
		collectionName: z.string().optional()
	})
	.passthrough();

export type CompanionUser = RecordModel & {
	email?: string;
	name?: string;
	avatar?: string;
	role?: string;
	steamIds?: string[];
	meta?: unknown;
	lastLogin?: string;
	appVersion?: string | null;
};

export class CompanionApi {
	constructor(private deps: ApiDeps) {}

	findCompanionUserBySteamId(steamId: string): ResultAsync<CompanionUser | null, ApiError> {
		const id = steamId.trim();
		if (!id || !this.deps.pocketbase.authStore.isValid) {
			return okAsync(null);
		}

		const escaped = escapePocketBaseString(id);
		return ResultAsync.fromPromise(
			this.deps.pocketbase.collection('users').getList(1, 1, pbOptions(this.deps, {
				filter: `steamIds ~ "${escaped}"`
			})),
			() => apiError(500, 'Could not load that account.')
		)
			.map((response) => {
				const row = response.items[0];
				if (!row) {
					return null;
				}

				const parsed = companionUserSchema.safeParse(row);
				if (!parsed.success) {
					return null;
				}

				const data = parsed.data;
				return {
					...row,
					...data,
					steamIds: Array.isArray(data.steamIds) ? data.steamIds.map(String) : [],
					appVersion: readMetaVersion(data.meta)
				} as CompanionUser;
			});
	}
}
