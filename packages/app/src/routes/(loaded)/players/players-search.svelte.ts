import type { RelicProfile } from '@fknoobs/app';
import type { Profile } from '$lib/components/ui/profile';
import type { SteamPlayerSummary } from '$core/steam';

export type PlayerSearchResult = Profile;

export type PlayersSearchState = {
	query: string;
	results: PlayerSearchResult[];
	error: string | null;
};

export function mergeSteamProfiles(
	profiles: RelicProfile[],
	steamProfiles: SteamPlayerSummary[]
): PlayerSearchResult[] {
	const steamById = Object.fromEntries(steamProfiles.map((profile) => [profile.steamid, profile]));

	return profiles.flatMap((profile) => {
		const steamId = profile.name.replace('/steam/', '');
		const steam = steamById[steamId];
		return steam ? [{ relic: profile, steam }] : [];
	});
}

export class PlayersSearch {
	query = $state('');
	error = $state<string | null>(null);
	results = $state<PlayerSearchResult[]>([]);

	capture(): PlayersSearchState {
		return {
			query: this.query,
			results: $state.snapshot(this.results),
			error: this.error
		};
	}

	restore(state: PlayersSearchState) {
		this.query = state.query;
		this.results = state.results;
		this.error = state.error;
	}

	resetResults() {
		this.results = [];
	}
}
