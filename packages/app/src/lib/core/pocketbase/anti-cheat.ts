import { api, unwrapApi } from '$core/api';
import type {
	AntiCheatReport,
	CaptureRecord,
	CaptureSessionHint,
	CheaterRecord
} from '@company-of-heroes/api';

export type { CaptureRecord, CaptureSessionHint, CheaterRecord, AntiCheatReport };

export async function listCapturesBySession(sessionId: number): Promise<CaptureRecord[]> {
	return unwrapApi(api.antiCheat.listCapturesBySession(sessionId));
}

export async function listCaptureSessionHints(
	steamId: string,
	page: number,
	options?: { userId?: string; perPage?: number }
): Promise<{ items: CaptureSessionHint[]; totalPages: number }> {
	return unwrapApi(api.antiCheat.listCaptureSessionHints(steamId, page, options));
}

export async function listCapturesBySessionIds(
	steamId: string,
	sessionIds: number[],
	options?: { userId?: string }
): Promise<CaptureRecord[]> {
	return unwrapApi(api.antiCheat.listCapturesBySessionIds(steamId, sessionIds, options));
}

export async function listCapturesBySteamId(
	steamId: string,
	options?: { userId?: string }
): Promise<CaptureRecord[]> {
	return unwrapApi(api.antiCheat.listCapturesBySteamId(steamId, options));
}

export async function listCapturesForUserSession(
	userId: string,
	sessionId: number
): Promise<CaptureRecord[]> {
	return unwrapApi(api.antiCheat.listCapturesForUserSession(userId, sessionId));
}

export async function listCaptures(options?: {
	page?: number;
	perPage?: number;
	query?: string;
	steamId?: string;
	userId?: string;
}): Promise<{ items: CaptureRecord[]; totalItems: number; totalPages: number }> {
	return unwrapApi(api.antiCheat.listCaptures(options));
}

export async function deleteCapture(id: string): Promise<void> {
	await unwrapApi(api.antiCheat.deleteCapture(id));
}

export async function deleteCaptures(
	ids: string[]
): Promise<{ deletedIds: string[]; failedIds: string[] }> {
	const deletedIds: string[] = [];
	const failedIds: string[] = [];

	for (const id of ids) {
		try {
			await deleteCapture(id);
			deletedIds.push(id);
		} catch (error) {
			try {
				await deleteCapture(id);
				deletedIds.push(id);
			} catch (retryError) {
				console.error('[ADMIN]: delete screenshot failed:', retryError ?? error);
				failedIds.push(id);
			}
		}
	}

	return { deletedIds, failedIds };
}

export async function hideCapture(id: string): Promise<void> {
	await unwrapApi(api.antiCheat.hideCapture(id));
}

export async function unhideCapture(id: string): Promise<void> {
	await unwrapApi(api.antiCheat.unhideCapture(id));
}

export async function loadCheaterSteamIds(steamIds: string[]): Promise<Set<string>> {
	return unwrapApi(api.antiCheat.loadCheaterSteamIds(steamIds));
}

export async function findCheaterBySteamId(steamId: string): Promise<CheaterRecord | null> {
	return unwrapApi(api.antiCheat.findCheaterBySteamId(steamId));
}

export async function labelCheaterAccounts(input: {
	userId: string;
	steamIds: string[];
	labeledBy?: string;
}): Promise<void> {
	await unwrapApi(api.antiCheat.labelCheaterAccounts(input));
}

export async function deleteCheaterLabelsForUser(userId: string): Promise<void> {
	await unwrapApi(api.antiCheat.deleteCheaterLabelsForUser(userId));
}

export async function listOwnReportForMatch(
	reporterId: string,
	sessionId: number
): Promise<AntiCheatReport[]> {
	return unwrapApi(api.antiCheat.listOwnReportForMatch(reporterId, sessionId));
}

export async function createPlayerFlag(input: {
	reporter: string;
	accused: string;
	sessionId: number;
	lobbyId?: string;
	accusedSteamId?: string;
}): Promise<void> {
	await unwrapApi(api.antiCheat.createPlayerFlag(input));
}
