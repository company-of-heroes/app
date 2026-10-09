import PocketBase, { ClientResponseError } from 'pocketbase';
import { liveLobbyToLobbyData } from './lobby-transform';
import type { LiveLobbyRecord, LobbyData, Player } from './types';

const USER_ID_PATTERN = /^[a-z0-9]{15}$/;
const POLL_MS = 2500;

export function getUserIdFromPath(): string | null {
	const fromPath = window.location.pathname.match(/^\/overlay\/([a-z0-9]{15})/);
	if (fromPath?.[1]) {
		return fromPath[1];
	}

	const fromQuery = new URLSearchParams(window.location.search).get('user');
	if (fromQuery && USER_ID_PATTERN.test(fromQuery)) {
		return fromQuery;
	}

	return null;
}

function pocketBaseUrl(): string {
	const injected = (window as Window & { __OPP_PB_URL?: string }).__OPP_PB_URL;
	if (typeof injected === 'string' && injected) {
		return injected.replace(/\/$/, '');
	}

	const fromEnv = import.meta.env.VITE_PB_URL;
	if (typeof fromEnv === 'string' && fromEnv) {
		return fromEnv;
	}

	if (window.location.pathname.startsWith('/overlay/')) {
		return window.location.origin;
	}

	const host = window.location.hostname;
	if (host === '127.0.0.1' || host === 'localhost') {
		return 'http://127.0.0.1:8090';
	}

	if (import.meta.env.DEV) {
		return 'http://127.0.0.1:8090';
	}

	return 'https://api.coh1stats.com';
}

async function loadSteamIds(pb: PocketBase, userId: string): Promise<string[] | undefined> {
	try {
		const user = await pb.collection('users').getOne<{ steamIds?: string[] }>(userId);
		return user.steamIds;
	} catch {
		return undefined;
	}
}

export function connectLobby(
	userId: string,
	onLobby: (data: LobbyData | null) => void
): () => void {
	if (!USER_ID_PATTERN.test(userId)) {
		onLobby(null);
		return () => {};
	}

	const pb = new PocketBase(pocketBaseUrl());
	// Polls share a request key: a slow response would otherwise be aborted by the next poll.
	pb.autoCancellation(false);
	let active = true;
	let steamIds: string[] | undefined;
	let currentRecord: LiveLobbyRecord | null = null;
	let pollTimer: number | null = null;
	const debugPoll =
		new URLSearchParams(window.location.search).has('debugPoll') ||
		new URLSearchParams(window.location.search).has('preview');

	const eloBySteamId = new Map<string, Player['storedElo']>();
	const fetchedSteamIds = new Set<string>();

	async function withStoredElo(record: LiveLobbyRecord): Promise<LiveLobbyRecord> {
		const players = record.players ?? [];
		const missing = [
			...new Set(
				players
					.filter(
						(player) => player.steamId && !player.storedElo && !fetchedSteamIds.has(player.steamId)
					)
					.map((player) => player.steamId as string)
			)
		];
		if (missing.length > 0) {
			try {
				const filter = missing.map((id) => `steamId="${id}"`).join('||');
				const rows = await pb.collection('player_ratings').getFullList<{
					steamId: string;
					elo?: Player['storedElo'];
				}>({ filter });
				for (const row of rows) {
					if (row.elo) {
						eloBySteamId.set(row.steamId, row.elo);
					}
				}
			} catch {
				// overlay can still use matchHistory
			}
			for (const id of missing) {
				fetchedSteamIds.add(id);
			}
		}

		return {
			...record,
			players: players.map((player) => {
				if (player.storedElo || !player.steamId) {
					return player;
				}

				const storedElo = eloBySteamId.get(player.steamId);
				return storedElo ? { ...player, storedElo } : player;
			})
		};
	}

	const applyRecord = (record: LiveLobbyRecord | null) => {
		if (!active) {
			return;
		}

		currentRecord = record;
		onLobby(record ? liveLobbyToLobbyData(record, steamIds) : null);
	};

	void loadSteamIds(pb, userId).then((ids) => {
		steamIds = ids;
		if (currentRecord) {
			onLobby(liveLobbyToLobbyData(currentRecord, steamIds));
		}
	});

	const poll = async () => {
		if (!active) {
			return;
		}

		if (debugPoll) {
			const w = window as unknown as Record<string, unknown>;
			w.__oppbotPollLast = Date.now();
			w.__oppbotPollCount = (typeof w.__oppbotPollCount === 'number' ? w.__oppbotPollCount : 0) + 1;
		}

		try {
			const record = await pb
				.collection('lobbies_live')
				.getFirstListItem<LiveLobbyRecord>(`user="${userId}"`);
			applyRecord(await withStoredElo(record));
		} catch (error) {
			// Only a missing row means the game ended; a slow or failed request keeps the last lobby.
			if (currentRecord && error instanceof ClientResponseError && error.status === 404) {
				applyRecord(null);
			}
		}

		if (active) {
			pollTimer = window.setTimeout(() => void poll(), POLL_MS);
		}
	};

	void poll();

	return () => {
		active = false;
		if (pollTimer != null) {
			window.clearTimeout(pollTimer);
		}
	};
}

export { getDevScenarioFromUrl, DEV_SCENARIOS, type DevScenario } from './test-data';
