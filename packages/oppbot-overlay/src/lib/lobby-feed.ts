import PocketBase from 'pocketbase';
import { liveLobbyToLobbyData } from './lobby-transform';
import type { LiveLobbyRecord, LobbyData } from './types';

const PB_URL = import.meta.env.VITE_PB_URL ?? 'https://api.coh1stats.com';
const USER_ID_PATTERN = /^[a-z0-9]{15}$/;

export function getUserIdFromPath(): string | null {
	const match = window.location.pathname.match(/^\/overlay\/([a-z0-9]{15})/);
	return match?.[1] ?? null;
}

async function loadSteamIds(pb: PocketBase, userId: string): Promise<string[] | undefined> {
	try {
		const user = await pb.collection('users').getOne<{ steamIds?: string[] }>(userId);
		return user.steamIds;
	} catch {
		return undefined;
	}
}

export function connectLobby(userId: string, onLobby: (data: LobbyData | null) => void): () => void {
	if (!USER_ID_PATTERN.test(userId)) {
		onLobby(null);
		return () => {};
	}

	const pb = new PocketBase(PB_URL);
	let active = true;
	let steamIds: string[] | undefined;
	let currentRecord: LiveLobbyRecord | null = null;
	let pollTimer: number | null = null;
	const debugPoll = new URLSearchParams(window.location.search).has('debugPoll');

	const applyRecord = (record: LiveLobbyRecord | null) => {
		if (!active) return;
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
		if (!active) return;
		if (debugPoll) {
			const w = window as unknown as Record<string, unknown>;
			w.__oppbotPollLast = Date.now();
			w.__oppbotPollCount = (typeof w.__oppbotPollCount === 'number' ? w.__oppbotPollCount : 0) + 1;
		}
		try {
			const record = await pb.collection('lobbies_live').getFirstListItem<LiveLobbyRecord>(`user="${userId}"`);
			applyRecord(record);
		} catch {
			if (currentRecord) applyRecord(null);
		}
	};

	void poll();
	pollTimer = window.setInterval(() => void poll(), 2500);

	return () => {
		active = false;
		if (pollTimer != null) window.clearInterval(pollTimer);
	};
}

export { getDevScenarioFromUrl, DEV_SCENARIOS, type DevScenario } from './test-data';
