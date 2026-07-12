export const COH_APP_ID = 228200;

export type PlayerPresence = {
	gameid?: string;
	gameextrainfo?: string;
	personastate: number;
};

export function parseCohStatsLenderFromHtml(html: string): string | null {
	const smurfCell = html.match(/<td[^>]*id="infoSmurfText"[^>]*>([\s\S]*?)<\/td>/i);
	if (!smurfCell) {
		return null;
	}

	const link = smurfCell[1].match(/href="\?steamid=(\d{17})"/i);
	return link?.[1] ?? null;
}

export function isPlayingCoH(summary: PlayerPresence | undefined): boolean {
	if (!summary) {
		return false;
	}

	const playingGame =
		summary.gameid === String(COH_APP_ID) ||
		summary.gameextrainfo?.trim() === 'Company of Heroes';

	return playingGame && summary.personastate === 1;
}
