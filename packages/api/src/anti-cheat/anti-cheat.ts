import { ClientResponseError, type RecordModel } from 'pocketbase';
import { errAsync, ok, okAsync, ResultAsync } from 'neverthrow';
import type { ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import { escapePocketBaseString, fromPbPromise, pbOptions } from '../pb';
import { PlayersApi } from '../players/players';
import { isValidSteamId } from '../ratings/ratings';
import { requireStaff } from '../staff';

const CAPTURE_NAME_SEARCH_LIMIT = 25;

export type CaptureRecord = RecordModel & {
	session_id?: number;
	steam_id?: string;
	map?: string;
	captured_at?: string;
	image?: string;
	user?: string;
	game_focused?: boolean;
	hidden?: boolean;
	hiddenAt?: string;
	hiddenBy?: string;
	expand?: {
		user?: RecordModel & {
			name?: string;
			email?: string;
			steamIds?: string[];
		};
	};
};

export type CaptureSessionHint = {
	session_id?: number;
	map?: string;
	captured_at?: string;
	created: string;
};

export type CheaterRecord = RecordModel & {
	steam_id: string;
	user: string;
	labeled_by?: string;
};

export type AntiCheatReport = RecordModel & {
	reporter: string;
	accused: string;
	session_id: number;
	lobby?: string;
	accused_steam_id?: string;
	status: 'pending' | 'dismissed' | 'confirmed';
	note?: string;
};

const SESSION_SCAN_PER_PAGE = 80;

function captureOwnerClauses(steamId: string, userId?: string): string[] {
	const escapedSteamId = steamId ? escapePocketBaseString(steamId) : '';
	const escapedUserId = userId ? escapePocketBaseString(userId) : '';
	const clauses: string[] = [];
	if (escapedSteamId) {
		clauses.push(`steam_id = "${escapedSteamId}"`);
		clauses.push(`user.steamIds ?= "${escapedSteamId}"`);
	}

	if (escapedUserId) {
		clauses.push(`user = "${escapedUserId}"`);
	}

	return clauses;
}

function captureOwnerFallbackClauses(steamId: string, userId?: string): string[] {
	const escapedSteamId = steamId ? escapePocketBaseString(steamId) : '';
	const escapedUserId = userId ? escapePocketBaseString(userId) : '';
	return [
		escapedSteamId ? `steam_id = "${escapedSteamId}"` : '',
		escapedUserId ? `user = "${escapedUserId}"` : ''
	].filter(Boolean);
}

function captureNameClauses(query: string): string[] {
	const escaped = escapePocketBaseString(query.trim());
	if (!escaped) {
		return [];
	}

	return [`user.name ~ "${escaped}"`, `user.email ~ "${escaped}"`];
}

function buildCaptureListFilter(input: {
	nameQuery?: string;
	steamIds: string[];
	userIds: string[];
}): { ownerFilter: string; fallbackFilter: string } {
	const owner = new Set<string>();
	const fallback = new Set<string>();

	for (const clause of captureNameClauses(input.nameQuery ?? '')) {
		owner.add(clause);
	}

	for (const steamId of input.steamIds) {
		for (const clause of captureOwnerClauses(steamId)) {
			owner.add(clause);
		}

		for (const clause of captureOwnerFallbackClauses(steamId)) {
			fallback.add(clause);
		}
	}

	for (const userId of input.userIds) {
		for (const clause of captureOwnerClauses('', userId)) {
			owner.add(clause);
		}

		for (const clause of captureOwnerFallbackClauses('', userId)) {
			fallback.add(clause);
		}
	}

	return {
		ownerFilter: [...owner].join(' || '),
		fallbackFilter: [...fallback].join(' || ')
	};
}

export class AntiCheatApi {
	constructor(private deps: ApiDeps) {}

	listCapturesBySession(sessionId: number): ResultAsync<CaptureRecord[], ApiError> {
		if (!Number.isInteger(sessionId) || sessionId <= 0) {
			return okAsync([]);
		}

		return fromPbPromise(
			this.deps.pocketbase.collection('anti_cheat_captures').getFullList<CaptureRecord>(
				pbOptions(this.deps, {
					filter: `session_id = ${sessionId}`,
					sort: 'captured_at',
					expand: 'user'
				})
			),
			'Failed to load captures.'
		).orElse(() => ok([]));
	}

	listCaptureSessionHints(
		steamId: string,
		page: number,
		options?: { userId?: string; perPage?: number }
	): ResultAsync<{ items: CaptureSessionHint[]; totalPages: number }, ApiError> {
		const perPage = options?.perPage ?? SESSION_SCAN_PER_PAGE;
		const filter = captureOwnerClauses(steamId, options?.userId).join(' || ');
		if (!filter) {
			return okAsync({ items: [], totalPages: 0 });
		}

		return ResultAsync.fromSafePromise(
			this.querySessionHints(page, perPage, filter, steamId, options?.userId)
		);
	}

	listCapturesBySessionIds(
		steamId: string,
		sessionIds: number[],
		options?: { userId?: string }
	): ResultAsync<CaptureRecord[], ApiError> {
		const unique = [...new Set(sessionIds.filter((id) => Number.isInteger(id) && id > 0))];
		if (unique.length === 0) {
			return okAsync([]);
		}

		return ResultAsync.fromSafePromise(
			this.queryCapturesBySessions(steamId, unique, options?.userId)
		);
	}

	listCapturesBySteamId(
		steamId: string,
		options?: { userId?: string }
	): ResultAsync<CaptureRecord[], ApiError> {
		const clauses = captureOwnerClauses(steamId, options?.userId);
		if (clauses.length === 0) {
			return okAsync([]);
		}

		return ResultAsync.fromSafePromise(this.queryCapturesBySteam(steamId, options?.userId));
	}

	listCapturesForUserSession(
		userId: string,
		sessionId: number
	): ResultAsync<CaptureRecord[], ApiError> {
		if (!userId || !Number.isInteger(sessionId) || sessionId <= 0) {
			return okAsync([]);
		}

		return fromPbPromise(
			this.deps.pocketbase.collection('anti_cheat_captures').getFullList<CaptureRecord>(
				pbOptions(this.deps, {
					filter: `user = "${escapePocketBaseString(userId)}" && session_id = ${sessionId}`,
					sort: 'captured_at'
				})
			),
			'Failed to load captures.'
		).orElse(() => ok([]));
	}

	listCaptures(options?: {
		page?: number;
		perPage?: number;
		query?: string;
		steamId?: string;
		userId?: string;
	}): ResultAsync<{ items: CaptureRecord[]; totalItems: number; totalPages: number }, ApiError> {
		const staff = requireStaff(this.deps);
		if (staff.isErr()) {
			return errAsync(staff.error);
		}

		return ResultAsync.fromSafePromise(this.queryCapturesList(options));
	}

	deleteCapture(id: string): ResultAsync<void, ApiError> {
		const staff = requireStaff(this.deps);
		if (staff.isErr()) {
			return errAsync(staff.error);
		}

		if (!id) {
			return errAsync(apiError(400, 'Could not delete screenshot.'));
		}

		return fromPbPromise(
			this.deps.pocketbase.collection('anti_cheat_captures').delete(id, pbOptions(this.deps)),
			'Could not delete screenshot.'
		).map(() => undefined);
	}

	hideCapture(id: string): ResultAsync<void, ApiError> {
		const staff = requireStaff(this.deps);
		if (staff.isErr()) {
			return errAsync(staff.error);
		}

		if (!id) {
			return errAsync(apiError(400, 'Could not hide screenshot.'));
		}

		return fromPbPromise(
			this.deps.pocketbase.collection('anti_cheat_captures').update(
				id,
				{
					hidden: true,
					hiddenAt: new Date().toISOString(),
					hiddenBy: staff.value
				},
				pbOptions(this.deps)
			),
			'Could not hide screenshot.'
		).map(() => undefined);
	}

	unhideCapture(id: string): ResultAsync<void, ApiError> {
		const staff = requireStaff(this.deps);
		if (staff.isErr()) {
			return errAsync(staff.error);
		}

		if (!id) {
			return errAsync(apiError(400, 'Could not show screenshot.'));
		}

		return fromPbPromise(
			this.deps.pocketbase.collection('anti_cheat_captures').update(
				id,
				{
					hidden: false,
					hiddenAt: null,
					hiddenBy: null
				},
				pbOptions(this.deps)
			),
			'Could not show screenshot.'
		).map(() => undefined);
	}

	loadCheaterSteamIds(steamIds: string[]): ResultAsync<Set<string>, ApiError> {
		const unique = [...new Set(steamIds.filter(Boolean))];
		if (unique.length === 0) {
			return okAsync(new Set());
		}

		return ResultAsync.fromSafePromise(this.queryCheaterSteamIds(unique));
	}

	findCheaterBySteamId(steamId: string): ResultAsync<CheaterRecord | null, ApiError> {
		if (!steamId) {
			return okAsync(null);
		}

		return ResultAsync.fromSafePromise(this.queryCheater(steamId));
	}

	labelCheaterAccounts(input: {
		userId: string;
		steamIds: string[];
		labeledBy?: string;
	}): ResultAsync<void, ApiError> {
		return ResultAsync.fromSafePromise(this.createCheaterLabels(input));
	}

	deleteCheaterLabelsForUser(userId: string): ResultAsync<void, ApiError> {
		if (!userId) {
			return okAsync(undefined);
		}

		return fromPbPromise(
			this.deps.pocketbase.collection('anti_cheat_cheaters').getFullList<CheaterRecord>(
				pbOptions(this.deps, {
					filter: `user = "${escapePocketBaseString(userId)}"`,
					fields: 'id'
				})
			),
			'Failed to load cheater labels.'
		)
			.andThen((rows) =>
				ResultAsync.combine(
					rows.map((row) =>
						fromPbPromise(
							this.deps.pocketbase
								.collection('anti_cheat_cheaters')
								.delete(row.id, pbOptions(this.deps)),
							'Failed to delete cheater label.'
						)
					)
				)
			)
			.map(() => undefined)
			.orElse(() => ok(undefined));
	}

	listOwnReportForMatch(
		reporterId: string,
		sessionId: number
	): ResultAsync<AntiCheatReport[], ApiError> {
		if (!reporterId || !Number.isInteger(sessionId) || sessionId <= 0) {
			return okAsync([]);
		}

		return fromPbPromise(
			this.deps.pocketbase.collection('anti_cheat_reports').getFullList<AntiCheatReport>(
				pbOptions(this.deps, {
					filter: `reporter = "${escapePocketBaseString(reporterId)}" && session_id = ${sessionId}`
				})
			),
			'Failed to load reports.'
		).orElse(() => ok([]));
	}

	createPlayerFlag(input: {
		reporter: string;
		accused: string;
		sessionId: number;
		lobbyId?: string;
		accusedSteamId?: string;
	}): ResultAsync<void, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('anti_cheat_reports').create(
				{
					reporter: input.reporter,
					accused: input.accused,
					session_id: input.sessionId,
					lobby: input.lobbyId || undefined,
					accused_steam_id: input.accusedSteamId || undefined,
					status: 'pending'
				},
				pbOptions(this.deps)
			),
			'Failed to create report.'
		).map(() => undefined);
	}

	private async queryCapturesList(options?: {
		page?: number;
		perPage?: number;
		query?: string;
		steamId?: string;
		userId?: string;
	}): Promise<{ items: CaptureRecord[]; totalItems: number; totalPages: number }> {
		const page = Math.max(1, options?.page ?? 1);
		const perPage = Math.min(100, Math.max(1, options?.perPage ?? 24));
		const query = options?.query?.trim() ?? '';
		const steamId = options?.steamId?.trim() ?? '';
		const userId = options?.userId?.trim() ?? '';
		const steamIds = new Set<string>();
		const userIds = new Set<string>();
		let nameQuery = '';

		if (isValidSteamId(steamId)) {
			steamIds.add(steamId);
		}

		if (userId) {
			userIds.add(userId);
		}

		if (query) {
			if (isValidSteamId(query)) {
				steamIds.add(query);
			} else {
				nameQuery = query;
				const escaped = escapePocketBaseString(query);
				try {
					const users = await this.deps.pocketbase
						.collection('users')
						.getList<RecordModel & { steamIds?: Array<string | number> }>(
							1,
							CAPTURE_NAME_SEARCH_LIMIT,
							pbOptions(this.deps, {
								filter: `name ~ "${escaped}" || email ~ "${escaped}"`,
								fields: 'id,steamIds'
							})
						);
					for (const user of users.items) {
						userIds.add(user.id);
						for (const id of user.steamIds ?? []) {
							const value = String(id);
							if (isValidSteamId(value)) {
								steamIds.add(value);
							}
						}
					}
				} catch {
					// Soft-fail companion lookup; name relation filter may still match.
				}

				const playersResult = await new PlayersApi(this.deps).search(query);
				if (playersResult.isOk()) {
					for (const player of playersResult.value.slice(0, CAPTURE_NAME_SEARCH_LIMIT)) {
						if (isValidSteamId(player.steamId)) {
							steamIds.add(player.steamId);
						}
					}
				}
			}
		}

		if (!nameQuery && steamIds.size === 0 && userIds.size === 0) {
			return this.queryCapturesPage(page, perPage, '', '');
		}

		const { ownerFilter, fallbackFilter } = buildCaptureListFilter({
			nameQuery,
			steamIds: [...steamIds],
			userIds: [...userIds]
		});

		return this.queryCapturesPage(page, perPage, ownerFilter, fallbackFilter);
	}

	private async queryCapturesPage(
		page: number,
		perPage: number,
		ownerFilter: string,
		fallbackFilter: string
	): Promise<{ items: CaptureRecord[]; totalItems: number; totalPages: number }> {
		const query = async (filter: string) =>
			this.deps.pocketbase.collection('anti_cheat_captures').getList<CaptureRecord>(
				page,
				perPage,
				pbOptions(this.deps, {
					filter: filter || undefined,
					sort: '-captured_at',
					expand: 'user'
				})
			);

		try {
			const response = await query(ownerFilter);
			return {
				items: response.items,
				totalItems: response.totalItems,
				totalPages: response.totalPages
			};
		} catch {
			if (!fallbackFilter || fallbackFilter === ownerFilter) {
				return { items: [], totalItems: 0, totalPages: 0 };
			}

			try {
				const response = await query(fallbackFilter);
				return {
					items: response.items,
					totalItems: response.totalItems,
					totalPages: response.totalPages
				};
			} catch {
				return { items: [], totalItems: 0, totalPages: 0 };
			}
		}
	}

	private async querySessionHints(
		page: number,
		perPage: number,
		filter: string,
		steamId: string,
		userId?: string
	): Promise<{ items: CaptureSessionHint[]; totalPages: number }> {
		const query = async (ownerFilter: string) =>
			this.deps.pocketbase.collection('anti_cheat_captures').getList<CaptureSessionHint>(
				page,
				perPage,
				pbOptions(this.deps, {
					filter: ownerFilter,
					sort: '-captured_at',
					fields: 'id,session_id,map,captured_at,created'
				})
			);

		try {
			const response = await query(filter);
			return { items: response.items, totalPages: response.totalPages };
		} catch {
			const fallback = captureOwnerFallbackClauses(steamId, userId).join(' || ');
			if (!fallback) {
				return { items: [], totalPages: 0 };
			}

			try {
				const response = await query(fallback);
				return { items: response.items, totalPages: response.totalPages };
			} catch {
				return { items: [], totalPages: 0 };
			}
		}
	}

	private async queryCapturesBySessions(
		steamId: string,
		unique: number[],
		userId?: string
	): Promise<CaptureRecord[]> {
		const owner = captureOwnerClauses(steamId, userId).join(' || ');
		const sessions = unique.map((id) => `session_id = ${id}`).join(' || ');
		const query = async (ownerFilter: string) =>
			this.deps.pocketbase.collection('anti_cheat_captures').getFullList<CaptureRecord>(
				pbOptions(this.deps, {
					filter: ownerFilter ? `(${ownerFilter}) && (${sessions})` : sessions,
					sort: 'captured_at'
				})
			);

		if (!owner) {
			try {
				return await query('');
			} catch {
				return [];
			}
		}

		try {
			return await query(owner);
		} catch {
			const fallback = captureOwnerFallbackClauses(steamId, userId).join(' || ');
			if (!fallback) {
				return [];
			}

			try {
				return await query(fallback);
			} catch {
				return [];
			}
		}
	}

	private async queryCapturesBySteam(steamId: string, userId?: string): Promise<CaptureRecord[]> {
		const clauses = captureOwnerClauses(steamId, userId);
		try {
			return await this.deps.pocketbase
				.collection('anti_cheat_captures')
				.getFullList<CaptureRecord>(
					pbOptions(this.deps, {
						filter: clauses.join(' || '),
						sort: '-captured_at'
					})
				);
		} catch {
			const fallback = captureOwnerFallbackClauses(steamId, userId);
			if (fallback.length === 0) {
				return [];
			}

			try {
				return await this.deps.pocketbase
					.collection('anti_cheat_captures')
					.getFullList<CaptureRecord>(
						pbOptions(this.deps, {
							filter: fallback.join(' || '),
							sort: '-captured_at'
						})
					);
			} catch {
				return [];
			}
		}
	}

	private async queryCheaterSteamIds(unique: string[]): Promise<Set<string>> {
		const filter = unique.map((id) => `steam_id = "${escapePocketBaseString(id)}"`).join(' || ');
		try {
			const rows = await this.deps.pocketbase
				.collection('anti_cheat_cheaters')
				.getFullList<CheaterRecord>(
					pbOptions(this.deps, {
						filter,
						fields: 'id,steam_id,user'
					})
				);
			const matched = new Set(rows.map((row) => row.steam_id));
			const leftover = unique.filter((id) => !matched.has(id));
			if (leftover.length === 0) {
				return matched;
			}

			try {
				const related = await this.deps.pocketbase
					.collection('anti_cheat_cheaters')
					.getFullList<CheaterRecord>(
						pbOptions(this.deps, {
							filter: leftover
								.map((id) => `user.steamIds ?= "${escapePocketBaseString(id)}"`)
								.join(' || '),
							fields: 'id,steam_id,user'
						})
					);
				if (related.length === 0) {
					return matched;
				}

				if (leftover.length === 1) {
					matched.add(leftover[0]);
					return matched;
				}

				await Promise.all(
					leftover.map(async (id) => {
						try {
							await this.deps.pocketbase.collection('anti_cheat_cheaters').getFirstListItem(
								`user.steamIds ?= "${escapePocketBaseString(id)}"`,
								pbOptions(this.deps, {
									fields: 'id'
								})
							);
							matched.add(id);
						} catch {
							// not labeled
						}
					})
				);
			} catch {
				// Soft-fail relation lookup.
			}

			return matched;
		} catch {
			return new Set();
		}
	}

	private async queryCheater(steamId: string): Promise<CheaterRecord | null> {
		const escaped = escapePocketBaseString(steamId);
		try {
			return await this.deps.pocketbase
				.collection('anti_cheat_cheaters')
				.getFirstListItem<CheaterRecord>(
					`steam_id = "${escaped}" || user.steamIds ?= "${escaped}"`,
					pbOptions(this.deps)
				);
		} catch {
			try {
				return await this.deps.pocketbase
					.collection('anti_cheat_cheaters')
					.getFirstListItem<CheaterRecord>(`steam_id = "${escaped}"`, pbOptions(this.deps));
			} catch {
				return null;
			}
		}
	}

	private async createCheaterLabels(input: {
		userId: string;
		steamIds: string[];
		labeledBy?: string;
	}): Promise<void> {
		const unique = [...new Set(input.steamIds.filter(Boolean))];
		for (const steamId of unique) {
			try {
				await this.deps.pocketbase.collection('anti_cheat_cheaters').create(
					{
						user: input.userId,
						steam_id: steamId,
						labeled_by: input.labeledBy || undefined
					},
					pbOptions(this.deps)
				);
			} catch (error) {
				if (error instanceof ClientResponseError && error.status === 400) {
					continue;
				}

				throw error;
			}
		}
	}
}
