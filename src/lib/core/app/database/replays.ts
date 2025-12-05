import { pocketbase } from '$core/pocketbase';

export class Replays {
	getAllForUser(steamid: string) {
		return pocketbase.collection('replays').getFullList(-1, {
			filter: `submittedBy="${steamid}"`,
			sort: '-gameDate'
		});
	}
}
