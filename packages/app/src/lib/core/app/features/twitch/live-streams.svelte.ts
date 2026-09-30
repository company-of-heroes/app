import type { HelixStream } from '@twurple/api';
import { pocketbase } from '$core/pocketbase';
import { fetch } from '$core/http/fetch';
import { siteApi } from '$core/api';
import { twitch } from './twitch.svelte';

const POLL_MS = 60_000;
const COH1_FALLBACK_GAME_IDS = ['17343', '4359', '22080', '789122137'];
const COH1_GAME_NAMES = [
	'Company of Heroes',
	'Company of Heroes: Opposing Fronts',
	'Company of Heroes: Tales of Valor',
	'Company of Heroes: Definitive Edition'
];

export type LiveStream = {
	id: string;
	userName: string;
	userDisplayName: string;
	title: string;
	gameName: string;
	viewers: number;
	thumbnailUrl: string;
};

function isAllowedGameName(name: string) {
	const normalized = name.trim().toLowerCase();
	return COH1_GAME_NAMES.some((allowed) => allowed.toLowerCase() === normalized);
}

function toLiveStream(stream: HelixStream): LiveStream {
	return {
		id: stream.id,
		userName: stream.userName,
		userDisplayName: stream.userDisplayName,
		title: stream.title,
		gameName: stream.gameName,
		viewers: stream.viewers,
		thumbnailUrl: stream.getThumbnailUrl(440, 248)
	};
}

function fromCatalog(value: unknown): LiveStream[] {
	const records = Array.isArray(value) ? value : [];
	const items: LiveStream[] = [];

	for (const record of records) {
		if (!record || typeof record !== 'object') {
			continue;
		}

		const row = record as Record<string, unknown>;
		const id = String(row.id ?? '');
		const userName = String(row.userName ?? row.user_login ?? '');
		const userDisplayName = String(row.userDisplayName ?? row.user_name ?? userName);
		const title = String(row.title ?? '');
		const gameName = String(row.gameName ?? row.game_name ?? '');
		const thumbnailUrl = String(row.thumbnailUrl ?? row.thumbnail_url ?? '');
		const viewers = Number(row.viewers ?? row.viewer_count) || 0;
		if (!id || !userName || !isAllowedGameName(gameName)) {
			continue;
		}

		items.push({ id, userName, userDisplayName, title, gameName, viewers, thumbnailUrl });
	}

	return items;
}

/**
 * Live CoH 1 / OF / ToV streams. Prefers the public PocketBase catalog so the
 * Twitch tab works without connecting an account; falls back to the user token.
 */
export class LiveStreamsFeed {
	items = $state.raw<LiveStream[]>([]);
	isLoading = $state(false);

	#gameIds: string[] | null = null;
	#pollInterval: ReturnType<typeof setInterval> | null = null;
	#started = false;

	get totalItems() {
		return this.items.length;
	}

	async start(): Promise<void> {
		if (this.#started) {
			return;
		}

		this.#started = true;

		try {
			await this.refresh();
		} catch (error) {
			console.warn('[LIVE_STREAMS]: initial refresh failed:', error);
		}

		this.#startPolling();
	}

	async stop(): Promise<void> {
		if (!this.#started) {
			return;
		}

		this.#started = false;
		this.#clearPolling();
		this.items = [];
		this.isLoading = false;
	}

	async refresh(): Promise<void> {
		this.isLoading = true;

		try {
			await this.#loadItems();
		} finally {
			this.isLoading = false;
		}
	}

	#startPolling() {
		this.#clearPolling();
		this.#pollInterval = setInterval(() => {
			void this.#loadItems().catch((error) => {
				console.warn('[LIVE_STREAMS]: poll refresh failed:', error);
			});
		}, POLL_MS);
	}

	#clearPolling() {
		if (this.#pollInterval) {
			clearInterval(this.#pollInterval);
			this.#pollInterval = null;
		}
	}

	async #resolveGameIds(): Promise<string[]> {
		if (this.#gameIds?.length) {
			return this.#gameIds;
		}

		const ids = [...COH1_FALLBACK_GAME_IDS];
		const client = twitch.client;
		if (!client) {
			return ids;
		}

		try {
			const byName = await client.games.getGamesByNames(COH1_GAME_NAMES);
			for (const game of byName) {
				if (!game.id || !isAllowedGameName(game.name) || ids.includes(game.id)) {
					continue;
				}

				ids.push(game.id);
			}
			this.#gameIds = ids;
		} catch (error) {
			console.warn('[LIVE_STREAMS]: game lookup failed:', error);
		}

		return ids;
	}

	async #loadItems(): Promise<void> {
		if (!this.#started) {
			return;
		}

		try {
			const data = await siteApi<{ items?: LiveStream[] }>('/twitch/streams');
			if (!this.#started) {
				return;
			}

			this.items = fromCatalog(data?.items);
			return;
		} catch (error) {
			console.warn('[LIVE_STREAMS]: catalog fetch failed:', error);
		}

		await this.#loadFromHelix();
	}

	async #loadFromHelix(): Promise<void> {
		if (!this.#started) {
			return;
		}

		const client = twitch.client;
		if (!client) {
			this.items = [];
			return;
		}

		const gameIds = await this.#resolveGameIds();
		if (!this.#started) {
			return;
		}

		const byId: Record<string, LiveStream> = {};
		for (const gameId of gameIds) {
			const result = await client.streams.getStreams({
				game: gameId,
				limit: 50
			});
			for (const stream of result.data) {
				if (!isAllowedGameName(stream.gameName)) {
					continue;
				}

				byId[stream.id] = toLiveStream(stream);
			}
		}

		if (!this.#started) {
			return;
		}

		this.items = Object.values(byId).sort((a, b) => b.viewers - a.viewers);
	}
}
