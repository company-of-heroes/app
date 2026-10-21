import { isPublicLiveLobby, type LiveLobby } from '$core/app/database/lobbies-live';
import type { UnsubscribeFunc } from 'pocketbase';
import { app } from '$core/app/context';
import { pocketbase } from '$core/pocketbase';
import { orderBy, uniqBy } from 'lodash-es';

const PRUNE_MS = 15_000;

/**
 * Reactive live lobby feed with PocketBase realtime subscription.
 * Multiple players may each have a lobbies_live row for the same session;
 * the dashboard shows unique lobbies by sessionId.
 * Realtime keeps it current: stale rows are pruned locally and the list only
 * reloads after a reconnect, so an open dashboard does not poll the API.
 */
export class LiveLobbiesFeed {
	items = $state<LiveLobby[]>([]);
	isLoading = $state(false);
	error = $state<string | null>(null);

	#unsubscribe: UnsubscribeFunc | null = null;
	#unsubscribeConnect: UnsubscribeFunc | null = null;
	#pruneInterval: ReturnType<typeof setInterval> | null = null;
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
			console.warn('[LIVE_LOBBIES]: initial refresh failed:', error);
			this.error = error instanceof Error ? error.message : String(error);
		}

		this.#startPruning();
		await this.#subscribe();
		await this.#reloadOnReconnect();
	}

	async stop(): Promise<void> {
		if (!this.#started) {
			return;
		}

		this.#started = false;
		this.#clearPruning();
		await this.#unsubscribe?.();
		this.#unsubscribe = null;
		await this.#unsubscribeConnect?.();
		this.#unsubscribeConnect = null;
		this.items = [];
		this.error = null;
	}

	async refresh(): Promise<void> {
		this.isLoading = true;

		try {
			await this.#loadItems();
			this.error = null;
		} catch (error) {
			this.error = error instanceof Error ? error.message : String(error);
			throw error;
		} finally {
			this.isLoading = false;
		}
	}

	async #subscribe(): Promise<void> {
		try {
			await this.#unsubscribe?.();

			this.#unsubscribe = await app.database.lobbiesLive.subscribe(async (event) => {
				if (event.action === 'delete') {
					const wasVisible = this.items.some((lobby) => lobby.id === event.record.id);
					this.items = this.items.filter((lobby) => lobby.id !== event.record.id);

					// Another player in the same session may still have a live row.
					if (wasVisible) {
						await this.#loadItems().catch((error) => {
							console.warn('[LIVE_LOBBIES]: reload after delete failed:', error);
							this.error = error instanceof Error ? error.message : String(error);
						});
					}

					return;
				}

				try {
					const lobby = event.record;
					if (lobby?.id && lobby.sessionId && isPublicLiveLobby(lobby)) {
						this.#upsert(lobby);
						this.error = null;
					} else if (lobby?.id) {
						this.items = this.items.filter((entry) => entry.id !== lobby.id);
					} else {
						await this.#loadItems();
						this.error = null;
					}
				} catch (error) {
					console.warn('[LIVE_LOBBIES]: failed to apply realtime event:', error);
					try {
						await this.#loadItems();
						this.error = null;
					} catch (reloadError) {
						this.error = reloadError instanceof Error ? reloadError.message : String(reloadError);
					}
				}
			});
		} catch (error) {
			console.warn('[LIVE_LOBBIES]: subscribe failed:', error);
			this.#unsubscribe = null;
			if (!this.error) {
				this.error = error instanceof Error ? error.message : String(error);
			}
		}
	}

	/** Events missed while the realtime connection was down are caught up with one reload. */
	async #reloadOnReconnect(): Promise<void> {
		let connected = pocketbase.realtime.isConnected;
		try {
			this.#unsubscribeConnect = await pocketbase.realtime.subscribe('PB_CONNECT', () => {
				if (!connected) {
					connected = true;
					return;
				}

				void this.#loadItems()
					.then(() => {
						this.error = null;
					})
					.catch((error) => {
						console.warn('[LIVE_LOBBIES]: reload after reconnect failed:', error);
					});
			});
		} catch (error) {
			console.warn('[LIVE_LOBBIES]: reconnect listener failed:', error);
		}
	}

	/** Rows of crashed games stop sending heartbeats; drop them once they go stale. */
	#startPruning() {
		this.#clearPruning();
		this.#pruneInterval = setInterval(() => {
			const now = Date.now();
			const fresh = this.items.filter((lobby) => isPublicLiveLobby(lobby, now));
			if (fresh.length !== this.items.length) {
				this.items = fresh;
			}
		}, PRUNE_MS);
	}

	#clearPruning() {
		if (this.#pruneInterval) {
			clearInterval(this.#pruneInterval);
			this.#pruneInterval = null;
		}
	}

	async #loadItems(): Promise<void> {
		const result = await app.database.lobbiesLive.getList(1, 48);
		this.items = uniqBy(result.items.filter(isPublicLiveLobby), 'sessionId');
	}

	#upsert(lobby: LiveLobby) {
		const withoutSameSession = this.items.filter(
			(entry) => entry.id !== lobby.id && entry.sessionId !== lobby.sessionId
		);
		this.items = orderBy([lobby, ...withoutSameSession], ['updatedAt'], ['desc']);
	}
}
