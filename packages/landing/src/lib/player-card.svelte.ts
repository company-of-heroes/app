import { API_URL } from './urls';

export type PlayerCardStat = {
	leaderboardId: number;
	modeLabel: string;
	factionLabel: string;
	ranklevel: number;
	rank: number;
	wins: number;
	losses: number;
	streak: number;
};

export type PlayerCardData = {
	steamId: string;
	profileId: number;
	alias: string;
	country: string | null;
	level: number;
	avatarUrl: string;
	stats: PlayerCardStat[];
};

export type PlayerCardState = {
	data: PlayerCardData | null;
	loading: boolean;
	error: string | null;
};

export const playerCardState = $state<PlayerCardState>({
	data: null,
	loading: false,
	error: null
});

export async function loadPlayerCard(steamId: string): Promise<void> {
	playerCardState.loading = true;
	playerCardState.error = null;
	playerCardState.data = null;

	try {
		const response = await fetch(`${API_URL}/api/player-card/${steamId}`);

		if (response.status === 404) {
			playerCardState.error = 'Player not found. Check the Steam ID and try again.';
			return;
		}

		if (!response.ok) {
			playerCardState.error = 'Failed to load player card. Please try again later.';
			return;
		}

		playerCardState.data = (await response.json()) as PlayerCardData;
	} catch {
		playerCardState.error = 'Failed to load player card. Please try again later.';
	} finally {
		playerCardState.loading = false;
	}
}

export function resetPlayerCard() {
	playerCardState.data = null;
	playerCardState.loading = false;
	playerCardState.error = null;
}
