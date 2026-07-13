export const COH_APP_ID = 228200;

// Steam names for appid 228200 ("New Steam Version"). Deliberately exact matches
// so CoH2/CoH3 never count as a hit; the gameid check is the primary signal anyway.
const COH_GAME_NAMES = new Set(['Company of Heroes', 'Company of Heroes (New Steam Version)']);

export type PlayerPresence = {
	gameid?: string;
	gameextrainfo?: string;
	personastate: number;
	communityvisibilitystate?: number;
	timecreated?: number;
	avatarhash?: string;
	personaname?: string;
};

export function parseCohStatsLenderFromHtml(html: string): string | null {
	const smurfCell = html.match(/<td[^>]*id="infoSmurfText"[^>]*>([\s\S]*?)<\/td>/i);
	if (!smurfCell) {
		return null;
	}

	const link = smurfCell[1].match(/href="\?steamid=(\d{17})"/i);
	return link?.[1] ?? null;
}

export function isProfilePrivate(summary: PlayerPresence | undefined): boolean {
	if (!summary || summary.communityvisibilitystate === undefined) {
		return false;
	}

	return summary.communityvisibilitystate !== 3;
}

export type OwnedCoHResult = {
	owns: boolean | null;
	playtimeMinutes: number | null;
};

export function interpretOwnedGamesResponse(response?: {
	game_count?: number;
	games?: { appid: number; playtime_forever?: number }[];
}): OwnedCoHResult {
	const games = response?.games ?? [];
	const cohGame = games.find((game) => game.appid === COH_APP_ID);

	if (cohGame) {
		return { owns: true, playtimeMinutes: cohGame.playtime_forever ?? null };
	}

	// A private profile returns an empty response object without game_count.
	// Only an explicit game_count means "visible library without CoH".
	if (typeof response?.game_count === 'number') {
		return { owns: false, playtimeMinutes: null };
	}

	return { owns: null, playtimeMinutes: null };
}

export function isPlayingCoH(summary: PlayerPresence | undefined): boolean {
	if (!summary) {
		return false;
	}

	// A set gameid means the player is in-game regardless of personastate
	// (away/snooze players were previously missed by requiring personastate === 1).
	return (
		summary.gameid === String(COH_APP_ID) ||
		COH_GAME_NAMES.has(summary.gameextrainfo?.trim() ?? '')
	);
}
