import type { RecordModel } from 'pocketbase';
import { err, errAsync, ok, okAsync, ResultAsync } from 'neverthrow';
import { sendV1, type ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import { isStaff, requireStaff } from '../staff';
import { fromClientError, fromPbPromise, pbOptions } from '../pb';

export type HiddenMatch = RecordModel & {
	sessionId: number;
	hiddenBy?: string;
	expand?: { hiddenBy?: RecordModel };
};

export type HiddenMatchKeyword = RecordModel & {
	word: string;
	createdBy?: string;
	expand?: { createdBy?: RecordModel };
};

const KEYWORD_CACHE_MS = 30_000;
let keywordCache: { words: string[]; at: number } | null = null;

export function titleMatchesHiddenKeyword(
	title: string | null | undefined,
	words: string[]
): boolean {
	const text = String(title ?? '');
	if (!text || words.length === 0) {
		return false;
	}

	for (const word of words) {
		const trimmed = word.trim();
		if (!trimmed) {
			continue;
		}

		const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		if (new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, 'i').test(text)) {
			return true;
		}
	}

	return false;
}

export function relicLobbyDescription(
	match:
		| {
				description?: string | null;
				result?: { description?: string | null } | null;
		  }
		| null
		| undefined
): string {
	if (!match) {
		return '';
	}

	if (typeof match.description === 'string' && match.description.trim()) {
		return match.description;
	}

	return String(match.result?.description ?? '');
}

export function isHiddenFromPublic(
	sessionId: number,
	description: string | null | undefined,
	hiddenIds: Set<number> | null | undefined,
	words: string[] | null | undefined
): boolean {
	if (sessionId > 0 && hiddenIds?.has(sessionId)) {
		return true;
	}

	return titleMatchesHiddenKeyword(description, words ?? []);
}

export function invalidateHiddenKeywordCache() {
	keywordCache = null;
}

export class HiddenMatchesApi {
	constructor(private deps: ApiDeps) {}

	isHidden(sessionId: number): ResultAsync<boolean, ApiError> {
		if (!isStaff(this.deps) || !Number.isInteger(sessionId) || sessionId <= 0) {
			return okAsync(false);
		}

		return this.find(sessionId).map((record) => !!record);
	}

	list(): ResultAsync<HiddenMatch[], ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('hidden_matches').getFullList<HiddenMatch>(
				pbOptions(this.deps, {
					sort: '-created',
					expand: 'hiddenBy'
				})
			),
			'Could not load hidden matches.'
		);
	}

	listSessionIds(): ResultAsync<Set<number>, ApiError> {
		return fromPbPromise(
			this.deps.pocketbase
				.collection('hidden_matches')
				.getFullList(pbOptions(this.deps, { fields: 'id,sessionId' })),
			'Could not load hidden matches.'
		).map((rows) => new Set(rows.map((row) => Number(row.sessionId)).filter((id) => id > 0)));
	}

	find(sessionId: number): ResultAsync<HiddenMatch | null, ApiError> {
		if (!Number.isInteger(sessionId) || sessionId <= 0) {
			return okAsync(null);
		}

		return fromPbPromise(
			this.deps.pocketbase.collection('hidden_matches').getFirstListItem<HiddenMatch>(
				`sessionId=${sessionId}`,
				pbOptions(this.deps, {
					expand: 'hiddenBy'
				})
			),
			'Could not load hidden matches.'
		).orElse((error) => (error.status === 404 ? ok(null) : err(error)));
	}

	hide(sessionId: number): ResultAsync<void, ApiError> {
		const staff = requireStaff(this.deps);
		if (staff.isErr()) {
			return errAsync(staff.error);
		}

		if (!Number.isInteger(sessionId) || sessionId <= 0) {
			return errAsync(apiError(400, 'Could not hide this match.'));
		}

		return fromPbPromise(
			sendV1(this.deps, '/hidden-matches', { method: 'POST', body: { sessionId } }),
			'Could not hide this match.'
		).map(() => undefined);
	}

	unhide(sessionId: number): ResultAsync<void, ApiError> {
		const staff = requireStaff(this.deps);
		if (staff.isErr()) {
			return errAsync(staff.error);
		}

		if (!Number.isInteger(sessionId) || sessionId <= 0) {
			return errAsync(apiError(400, 'Could not show this match.'));
		}

		return fromPbPromise(
			sendV1(this.deps, `/hidden-matches/${sessionId}`, { method: 'DELETE' }),
			'Could not show this match.'
		).map(() => undefined);
	}

	listKeywords(): ResultAsync<HiddenMatchKeyword[], ApiError> {
		return fromPbPromise(
			this.deps.pocketbase.collection('hidden_match_keywords').getFullList<HiddenMatchKeyword>(
				pbOptions(this.deps, {
					sort: 'word',
					expand: 'createdBy'
				})
			),
			'Could not load hidden keywords.'
		);
	}

	listKeywordWords(): ResultAsync<string[], ApiError> {
		const now = Date.now();
		if (keywordCache && now - keywordCache.at < KEYWORD_CACHE_MS) {
			return okAsync(keywordCache.words);
		}

		return fromPbPromise(
			this.deps.pocketbase
				.collection('hidden_match_keywords')
				.getFullList(pbOptions(this.deps, { fields: 'id,word' })),
			'Could not load hidden keywords.'
		).map((rows) => {
			const words = rows.map((row) => String(row.word ?? '').trim()).filter(Boolean);
			keywordCache = { words, at: Date.now() };
			return words;
		});
	}

	addKeyword(word: string): ResultAsync<HiddenMatchKeyword, ApiError> {
		return fromPbPromise(
			sendV1<HiddenMatchKeyword>(this.deps, '/hidden-matches/keywords', {
				method: 'POST',
				body: { word: word.trim() }
			}),
			'Could not add hidden keyword.'
		).map((created) => {
			invalidateHiddenKeywordCache();
			return created;
		});
	}

	deleteKeyword(id: string): ResultAsync<void, ApiError> {
		return fromPbPromise(
			sendV1(this.deps, `/hidden-matches/keywords/${encodeURIComponent(id)}`, { method: 'DELETE' }),
			'Could not delete hidden keyword.'
		).map(() => {
			invalidateHiddenKeywordCache();
			return undefined;
		});
	}

	filterPublicMatchHistory<T extends { id: number; description?: string }>(
		matches: T[],
		isStaffUser: boolean
	): ResultAsync<T[], ApiError> {
		if (isStaffUser) {
			return okAsync(matches);
		}

		return ResultAsync.combine([
			this.listSessionIds().orElse(() => ok(new Set<number>())),
			this.listKeywordWords().orElse(() => ok([] as string[]))
		]).map(([ids, words]) =>
			matches.filter(
				(match) => !ids.has(match.id) && !titleMatchesHiddenKeyword(match.description, words)
			)
		);
	}
}

export function toHiddenError(error: unknown, fallback: string): ApiError {
	return fromClientError(error, fallback);
}
