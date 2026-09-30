/** Replay roster rows the owner edits (Steam links) on a member replay. */
export type MemberReplayRosterPlayer = {
	name?: string;
	alias?: string;
	faction?: string;
	steamId?: string | null;
	doctrineName?: string;
	id?: number;
};

function parseJsonArray(raw: unknown): unknown[] {
	if (Array.isArray(raw)) {
		return raw;
	}

	if (typeof raw === 'string' && raw.trim()) {
		try {
			const parsed: unknown = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	return [];
}

function rosterPlayerFromUnknown(raw: unknown, index: number): MemberReplayRosterPlayer {
	const player =
		raw && typeof raw === 'object'
			? (raw as Record<string, unknown>)
			: ({} as Record<string, unknown>);
	const profile =
		player.profile && typeof player.profile === 'object'
			? (player.profile as Record<string, unknown>)
			: null;
	const name = String(
		player.name || player.alias || profile?.alias || `Player ${index + 1}`
	).trim();
	const steamRaw = player.steamId;
	const steamId = steamRaw != null && String(steamRaw).trim() ? String(steamRaw).trim() : undefined;
	const faction = player.faction != null ? String(player.faction) : undefined;
	const doctrineName = player.doctrineName != null ? String(player.doctrineName) : undefined;
	const idRaw = player.id ?? player.playerId ?? profile?.profile_id;
	const idNum = Number(idRaw);
	const id = Number.isFinite(idNum) && idNum > 0 ? idNum : undefined;

	return {
		name,
		alias: name,
		faction,
		steamId,
		doctrineName,
		id
	};
}

/**
 * Build an editable roster from member detail (`roster` preferred, else community `players`).
 */
export function memberReplayRosterForEdit(match: {
	roster?: unknown;
	players?: unknown;
}): MemberReplayRosterPlayer[] {
	const fromRoster = parseJsonArray(match.roster).map(rosterPlayerFromUnknown);
	if (fromRoster.length > 0) {
		return fromRoster;
	}

	return parseJsonArray(match.players).map(rosterPlayerFromUnknown);
}
