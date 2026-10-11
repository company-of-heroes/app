import type { RelicProfile } from '@fknoobs/app';
import { steam, type SteamPlayerSummary } from '$core/steam';
import {
	enqueueSmurfWatch,
	getSmurfWatch,
	type SmurfWatchSource
} from '$core/pocketbase/smurf-watch';
import { relic } from '$lib/relic';

export type SmurfAlertState =
	| { status: 'not_shared' }
	| { status: 'pending' }
	| {
			status: 'shared';
			lenderSteamId: string;
			lenderProfile: RelicProfile | null;
			lenderSteam: SteamPlayerSummary | null;
	  };

/**
 * @param profileId - The Relic profile id, or a loader for it. A loader only runs when the
 *   player still has to be queued, so callers can start before the Relic profile is in.
 */
export async function loadSmurfAlert(
	steamId: string,
	profileId?: number | (() => Promise<number | undefined>),
	source: SmurfWatchSource = 'profile'
): Promise<SmurfAlertState> {
	const watch = await getSmurfWatch(steamId);

	if (!watch) {
		void Promise.resolve(typeof profileId === 'function' ? profileId() : profileId)
			.catch(() => undefined)
			.then((id) => enqueueSmurfWatch({ steamId, profileId: id, source, priority: 75 }));
		return { status: 'pending' };
	}

	if (watch.status === 'resolved' && watch.lender_steam_id) {
		const [lenderProfile, lenderSteam] = await Promise.all([
			relic.getProfileBySteamId(watch.lender_steam_id),
			steam.getUserProfile(watch.lender_steam_id)
		]);

		return {
			status: 'shared',
			lenderSteamId: watch.lender_steam_id,
			lenderProfile,
			lenderSteam
		};
	}

	if (watch.status === 'watching' || watch.status === 'pending_screening') {
		return { status: 'pending' };
	}

	return { status: 'not_shared' };
}
