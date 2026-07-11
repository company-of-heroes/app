import type { RelicProfile } from '@fknoobs/app';
import { steam, type SteamPlayerSummary } from '$core/steam';
import { enqueueSmurfWatch, getSmurfWatch } from '$core/pocketbase/smurf-watch';
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

export async function loadSmurfAlert(
	steamId: string,
	profileId?: number
): Promise<SmurfAlertState> {
	const watch = await getSmurfWatch(steamId);

	if (!watch) {
		void enqueueSmurfWatch({ steamId, profileId, source: 'profile', priority: 75 });
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
