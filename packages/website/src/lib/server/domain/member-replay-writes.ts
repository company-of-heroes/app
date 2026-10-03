import { resultMatchTypeId } from '@company-of-heroes/ui/format/match-type';
import { z } from 'zod';
import {
	matchTypeFromPlayerCount,
	normalizeSteamId,
	parseJsonList,
	type ReplayRosterPlayer,
	type StatsSnapshot
} from './member-replays';

/** Booleans and numbers may arrive as strings from multipart forms. */
const bool = z.preprocess(
	(value) => (value === 'true' ? true : value === 'false' ? false : value),
	z.boolean()
);
const count = z.coerce.number().refine(Number.isFinite).catch(0);
/** Players and chat arrive as JSON arrays (or their string form). */
const jsonList = z.preprocess(
	(value) => parseJsonList<Record<string, unknown>>(value),
	z.array(z.record(z.string(), z.unknown())).max(16)
);
const description = z.string().trim().min(1, 'Description is required.').max(2000);

/** Metadata of an uploaded .rec file (the analyzer parses it in the browser or app). */
export const memberUploadSchema = z.object({
	filename: z.string().trim().max(255).default(''),
	title: z.string().trim().max(200).default(''),
	description,
	mapName: z.string().trim().max(200).default(''),
	mapFilename: z.string().trim().max(200).default(''),
	durationInSeconds: count.default(0),
	gameDate: z.string().trim().max(40).default(''),
	isRanked: bool.default(false),
	isVpGame: bool.default(false),
	isRandomStart: bool.default(false),
	isHighResources: bool.default(false),
	vpCount: count.default(0),
	players: jsonList.default([]),
	messages: z.preprocess((value) => parseJsonList(value), z.array(z.unknown())).default([])
});
export type MemberUpload = z.infer<typeof memberUploadSchema>;

/** What the owner may change; `visibility: 'deleted'` is the soft delete. */
export const memberUpdateSchema = z.object({
	title: z.string().trim().min(1, 'Title is required.').max(200).optional(),
	description: description.optional(),
	players: jsonList.optional(),
	visibility: z.literal('deleted').optional()
});
export type MemberUpdate = z.infer<typeof memberUpdateSchema>;

export const publishFromMatchSchema = z.object({
	title: z.string().trim().max(200).default(''),
	description,
	durationInSeconds: count.optional(),
	players: jsonList.optional()
});
export type PublishFromMatch = z.infer<typeof publishFromMatchSchema>;

const FACTIONS = ['allies', 'axis', 'allies_commonwealth', 'axis_panzer_elite'];

type MatchResult = {
	matchtype_id?: number;
	startgametime?: number;
	completiontime?: number;
	players?: unknown;
};
type ResultPlayer = Record<string, unknown> & {
	profile_id?: number;
	alias?: string;
	race_id?: number;
};

/** Roster for a replay published from a match: the lobby's players, else the Relic result's. */
export function rosterFromMatch(
	lobbyPlayers: unknown,
	result: MatchResult | null
): ReplayRosterPlayer[] {
	const fromLobby = parseJsonList<Record<string, unknown>>(lobbyPlayers);
	if (fromLobby.length > 0) {
		return fromLobby.map((player, index) => {
			const alias = String(player.name || player.alias || '').trim() || `Player ${index + 1}`;
			return {
				name: alias,
				alias,
				steamId: normalizeSteamId(player.steamId || player.name),
				faction:
					String(player.faction || '').trim() || FACTIONS[Number(player.race_id)] || 'allies',
				doctrineName: String(player.doctrineName || '').trim() || undefined,
				id: Number(player.id || player.profile_id) || index + 1
			};
		});
	}

	const players = Array.isArray(result?.players) ? (result.players as ResultPlayer[]) : [];
	return players.map((player, index) => {
		const alias = String(player.alias || player.name || '').trim() || `Player ${index + 1}`;
		return {
			name: alias,
			alias,
			steamId: normalizeSteamId(player.steamId || player.name),
			faction: FACTIONS[Number(player.race_id)] || 'allies',
			id: Number(player.profile_id) || index + 1
		};
	});
}

/** A finished match already has its ratings: freeze them from the Relic result. */
export function snapshotFromResult(
	result: MatchResult | null,
	isRanked: boolean,
	durationInSeconds: number
): StatsSnapshot | null {
	const players = Array.isArray(result?.players) ? (result.players as ResultPlayer[]) : [];
	if (!result || players.length === 0) {
		return null;
	}

	// Relic's type wins, including 0 (Basic Match); the player count is only a fallback.
	const matchtypeId = resultMatchTypeId(result);
	return {
		matchtype_id: matchtypeId ?? matchTypeFromPlayerCount(players.length, isRanked),
		startgametime: Number(result.startgametime) || 0,
		completiontime: Number(result.completiontime) || Math.max(durationInSeconds, 0),
		players: players.map((player, i) => ({
			profile_id: Number(player.profile_id) || i + 1,
			alias: String(player.alias ?? ''),
			race_id: Number(player.race_id) || 0,
			oldrating: Number(player.oldrating) || 0,
			newrating: Number(player.newrating) || 0,
			wins: Number(player.wins) || 0,
			losses: Number(player.losses) || 0,
			streak: Number(player.streak) || 0,
			...(player.steamId ? { steamId: String(player.steamId) } : {}),
			...(player.country ? { country: String(player.country) } : {})
		})),
		snappedAt: new Date().toISOString()
	};
}

/**
 * The match snapshot in roster order (stats are read per slot). Null when a roster
 * player has no result entry by Steam id or alias.
 */
export function alignSnapshotToRoster(
	snapshot: StatsSnapshot,
	roster: ReplayRosterPlayer[]
): StatsSnapshot | null {
	const key = (value: unknown) =>
		String(value ?? '')
			.trim()
			.toLowerCase();
	const players = roster.map((player) => {
		const steamId = normalizeSteamId(player.steamId);
		const name = key(player.name || player.alias);
		return (
			(steamId && snapshot.players.find((entry) => entry.steamId === steamId)) ||
			(name ? snapshot.players.find((entry) => key(entry.alias) === name) : undefined)
		);
	});
	if (players.some((player) => !player)) {
		return null;
	}

	return { ...snapshot, players: players as StatsSnapshot['players'] };
}

/** Requested duration, else the match's; PocketBase treats 0 as blank, so at least 1. */
export function publishDuration(
	requested: number | undefined,
	stored: number,
	result: MatchResult | null
): number {
	if (requested && requested > 0) {
		return Math.floor(requested);
	}

	if (stored > 0) {
		return Math.floor(stored);
	}

	const start = Number(result?.startgametime);
	const end = Number(result?.completiontime);
	if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
		return Math.floor(end - start);
	}

	return Number.isFinite(end) && end > 0 ? Math.floor(end) : 1;
}
