import { fetch } from '$core/http/fetch';
import { PUBLIC_PB_URL } from '$env/static/public';
import { pocketbase } from '$core/pocketbase';

export type SmurfWatchStatus = 'pending_screening' | 'watching' | 'resolved' | 'not_smurf';
export type SmurfWatchSource = 'profile' | 'search' | 'lobby_live' | 'lobby_match' | 'backfill';
export type SmurfLenderSource = 'live' | 'cohstats';

export type SmurfWatchRecord = {
	id: string;
	steam_id: string;
	profile_id?: number;
	status: SmurfWatchStatus;
	source?: SmurfWatchSource;
	lender_steam_id?: string | null;
	lender_source?: SmurfLenderSource | null;
	owns_coh?: boolean | null;
	next_check_at?: string;
};

const baseUrl = () => (PUBLIC_PB_URL ?? 'https://api.coh1stats.com').replace(/\/$/, '');

export async function getSmurfWatch(steamId: string): Promise<SmurfWatchRecord | null> {
	try {
		const response = await fetch(`${baseUrl()}/api/smurf-watch/${steamId}`);
		if (response.status === 404) {
			return null;
		}

		if (!response.ok) {
			return null;
		}

		return (await response.json()) as SmurfWatchRecord;
	} catch {
		return null;
	}
}

export async function enqueueSmurfWatch(input: {
	steamId: string;
	profileId?: number;
	source: SmurfWatchSource;
	priority?: number;
}): Promise<void> {
	try {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		if (pocketbase.authStore.token) {
			headers.Authorization = pocketbase.authStore.token;
		}

		await fetch(`${baseUrl()}/api/smurf-watch/enqueue`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				steam_id: input.steamId,
				profile_id: input.profileId,
				source: input.source,
				priority: input.priority
			})
		});
	} catch (error) {
		console.warn('[smurf_watch] enqueue failed', error);
	}
}
