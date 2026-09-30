import { api, unwrapApi } from '$core/api';
import type { SmurfWatchRecord, SmurfWatchSource, SmurfWatchStatus } from '@company-of-heroes/api';

export type { SmurfWatchRecord, SmurfWatchSource, SmurfWatchStatus };

export type SmurfLenderSource = 'live' | 'cohstats'; // cohstats is legacy read-only
export type SmurfVerdict = 'confirmed_shared' | 'likely_smurf' | 'suspicious' | 'clean' | 'unknown';

export async function getSmurfWatch(steamId: string): Promise<SmurfWatchRecord | null> {
	return unwrapApi(api.smurfWatch.get(steamId));
}

export async function enqueueSmurfWatch(input: {
	steamId: string;
	profileId?: number;
	source: SmurfWatchSource;
	priority?: number;
}): Promise<void> {
	await unwrapApi(api.smurfWatch.enqueue(input));
}
