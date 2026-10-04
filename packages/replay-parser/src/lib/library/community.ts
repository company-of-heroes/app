import { isCpuPlayerName, raceFromReplayFaction } from '@company-of-heroes/ui/replay';
import type { CommunityMatchDetail, CommunityPlayer } from '@company-of-heroes/ui/replay';
import { mapKey } from '$lib/media';
import { replayTime } from './replay-library.svelte';
import type { ReplayEntry } from './types';

/** Detail route of a local replay; the file path is its id. */
export const replayHref = (path: string) => `/replay?file=${encodeURIComponent(path)}`;

/**
 * A local replay in the shape the shared list / overview render (same as the website).
 * `kind: 'member'` so the list shows the in-game replay name; there is no community data.
 */
export function toCommunityMatch(
	entry: ReplayEntry
): CommunityMatchDetail & { commentCount: number } {
	const summary = entry.summary;
	const players: CommunityPlayer[] = (summary?.players ?? []).map((player) => ({
		playerId: isCpuPlayerName(player.name) ? -1 : 0,
		steamId: null,
		race: raceFromReplayFaction(player.faction),
		faction: player.faction,
		doctrineName: player.doctrineName,
		profile: { profile_id: 0, alias: player.name }
	}));

	return {
		id: entry.path,
		kind: 'member',
		title: summary?.replayName || undefined,
		map: mapKey(summary?.mapFileName) || entry.fileName.replace(/\.rec$/i, ''),
		mapFilename: summary?.mapFileName,
		isRanked: summary?.matchType === 'automatch',
		createdAt: new Date(replayTime(entry)).toISOString(),
		durationSeconds: summary?.durationSeconds ?? null,
		likeCount: 0,
		downloadCount: 0,
		commentCount: 0,
		players,
		result: {},
		replay: entry.fileName,
		hasReplay: true
	};
}
