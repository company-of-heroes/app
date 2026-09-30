import { api, unwrapApi } from '$core/api';
import { account } from '$core/account';
import {
	titleMatchesHiddenKeyword,
	relicLobbyDescription,
	isHiddenFromPublic,
	invalidateHiddenKeywordCache
} from '@company-of-heroes/api';
import type { HiddenMatchKeywordsResponse, HiddenMatchesResponse, UsersResponse } from './types';

export type HiddenMatch = HiddenMatchesResponse<{ hiddenBy?: UsersResponse }>;
export type HiddenMatchKeyword = HiddenMatchKeywordsResponse<{ createdBy?: UsersResponse }>;

export {
	titleMatchesHiddenKeyword,
	relicLobbyDescription,
	isHiddenFromPublic,
	invalidateHiddenKeywordCache
};

export async function listHiddenMatches(): Promise<HiddenMatch[]> {
	return (await unwrapApi(api.hiddenMatches.list())) as HiddenMatch[];
}

export async function listHiddenSessionIds(): Promise<Set<number>> {
	return unwrapApi(api.hiddenMatches.listSessionIds());
}

export async function findHiddenMatch(sessionId: number): Promise<HiddenMatch | null> {
	return (await unwrapApi(api.hiddenMatches.find(sessionId))) as HiddenMatch | null;
}

/** `hiddenBy` is kept for call-site compatibility; staff id comes from auth. */
export async function hideMatch(sessionId: number, _hiddenBy?: string): Promise<HiddenMatch> {
	await unwrapApi(api.hiddenMatches.hide(sessionId));
	const record = await findHiddenMatch(sessionId);
	if (!record) {
		throw new Error('Could not hide this match.');
	}

	return record;
}

export async function unhideMatch(sessionId: number): Promise<void> {
	await unwrapApi(api.hiddenMatches.unhide(sessionId));
}

export async function listHiddenKeywords(): Promise<HiddenMatchKeyword[]> {
	return (await unwrapApi(api.hiddenMatches.listKeywords())) as HiddenMatchKeyword[];
}

export async function listHiddenKeywordWords(): Promise<string[]> {
	return unwrapApi(api.hiddenMatches.listKeywordWords());
}

export async function addHiddenKeyword(word: string): Promise<HiddenMatchKeyword> {
	return (await unwrapApi(api.hiddenMatches.addKeyword(word))) as HiddenMatchKeyword;
}

export async function deleteHiddenKeyword(id: string): Promise<void> {
	await unwrapApi(api.hiddenMatches.deleteKeyword(id));
}

export async function filterPublicMatchHistory<T extends { id: number; description?: string }>(
	matches: T[]
): Promise<T[]> {
	return unwrapApi(api.hiddenMatches.filterPublicMatchHistory(matches, account.isStaff));
}
