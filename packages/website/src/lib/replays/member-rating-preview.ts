import { isValidSteamId } from '@company-of-heroes/api';
import type { LiveLobbyPlayer } from '@company-of-heroes/ui/live-lobby/types';
import type { MatchResultPlayer } from '$lib/replays';

export type MemberReplayPreviewPlayer = {
	name?: string;
	alias?: string;
	steamId?: string | null;
	faction?: string;
	id?: number;
};

export type MemberReplayStatsPreview = {
	matchtype_id: number;
	players: MatchResultPlayer[];
	livePlayers: LiveLobbyPlayer[];
};

function normalizeSteamId(value: string | null | undefined): string | null {
	if (value == null || value === '') {
		return null;
	}

	const raw = String(value).trim();
	const fromPath = raw.match(/\/steam\/(\d+)/i);
	const candidate = fromPath
		? fromPath[1]
		: raw.replace(/^[^\d]*/, '').replace(/[^\d].*$/, '');
	if (isValidSteamId(candidate)) {
		return candidate;
	}

	if (isValidSteamId(raw)) {
		return raw;
	}

	return null;
}

export function steamIdsFromPreviewPlayers(players: MemberReplayPreviewPlayer[]): string[] {
	const ids: string[] = [];
	const seen: Record<string, true> = {};
	for (const player of players) {
		const steamId = normalizeSteamId(player.steamId);
		if (!steamId || seen[steamId]) {
			continue;
		}

		seen[steamId] = true;
		ids.push(steamId);
	}

	return ids;
}
