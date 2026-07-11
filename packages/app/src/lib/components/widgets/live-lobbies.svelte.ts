import type { LiveLobby } from '$core/app/database/lobbies-live';
import type { UnsubscribeFunc } from 'pocketbase';
import { app } from '$core/app/context';
import { orderBy } from 'lodash-es';

/**
 * Reactive live lobby feed with PocketBase realtime subscription.
 */
export class LiveLobbiesFeed {
	items = $state<LiveLobby[]>([]);
	isLoading = $state(false);

	#unsubscribe: UnsubscribeFunc | null = null;
	#started = false;

	get totalItems() {
		return this.items.length;
	}

	async start(): Promise<void> {
		if (this.#started) return;

		this.#started = true;
		await this.refresh();
		await this.#subscribe();
	}

	async stop(): Promise<void> {
		if (!this.#started) return;

		this.#started = false;
		await this.#unsubscribe?.();
		this.#unsubscribe = null;
		this.items = [];
	}

	async refresh(): Promise<void> {
		this.isLoading = true;

		try {
			const result = await app.database.lobbiesLive.getList(1, 24);
			this.items = result.items;
		} finally {
			this.isLoading = false;
		}
	}

	async #subscribe(): Promise<void> {
		await this.#unsubscribe?.();

		this.#unsubscribe = await app.database.lobbiesLive.subscribe(async (event) => {
			if (event.action === 'delete') {
				this.items = this.items.filter((lobby) => lobby.id !== event.record.id);
				return;
			}

			try {
				const lobby = await app.database.lobbiesLive.getOne(event.record.id);
				this.#upsert(lobby);
			} catch (error) {
				console.warn('[LIVE_LOBBIES]: failed to refresh lobby after realtime event:', error);
			}
		});
	}

	#upsert(lobby: LiveLobby) {
		const index = this.items.findIndex((entry) => entry.id === lobby.id);

		if (index === -1) {
			this.items = orderBy([lobby, ...this.items], ['updatedAt'], ['desc']);
			return;
		}

		const items = [...this.items];
		items[index] = lobby;
		this.items = orderBy(items, ['updatedAt'], ['desc']);
	}
}
