import type { UnsubscribeFunc } from 'pocketbase';
import { untrack } from 'svelte';
import { app } from '$core/app/context';
import type { Match as LobbyMatch, MatchExpanded } from '$core/app/database/matches';
import { fetch } from '$core/http/fetch';
import { exp } from '$core/pocketbase';
import {
	collectTodayMatchSteamIds,
	isMatchFromLast24Hours,
	matchIncludesSteamIds,
	recentPlayedMatchesFilter
} from './dashboard-utils';

const LIMIT = 200;
const REFETCH_MS = 3_000;

/** What the dashboard reads: the match table, the today record and the steam id checks. */
const FIELDS = [
	'id',
	'collectionId',
	'collectionName',
	'createdAt',
	'updatedAt',
	'user',
	'map',
	'title',
	'sessionId',
	'isRanked',
	'needsResult',
	'hasFailed',
	'players',
	'lobbyPlayers',
	'result',
	'durationSeconds',
	'avgElo',
	'likeCount',
	'downloadCount',
	'commentCount',
	'hasReplay',
	'replay'
].join(',');

/** Linked accounts plus the in-game one (not while impersonating). */
function lobbySteamIds(): string[] {
	const live = app.account.isImpersonating ? null : (app.game.profile?.steam.steamid ?? null);
	return collectTodayMatchSteamIds([
		...(app.features.auth.user.steamIds ?? []),
		...(live ? [live] : [])
	]).sort();
}

/**
 * Lobbies of the last 24 hours for the user's accounts, shared by the dashboard widgets:
 * one list request and one realtime subscription while at least one widget is mounted.
 */
class TodayLobbies {
	items = $state.raw<MatchExpanded[]>([]);
	loading = $state(true);

	#users = 0;
	#dispose: (() => void) | null = null;

	acquire() {
		this.#users += 1;
		if (this.#users > 1) {
			return;
		}

		this.#dispose = $effect.root(() => {
			$effect(() => {
				const key = lobbySteamIds().join(',');
				return untrack(() => this.#start(key));
			});
		});
	}

	release() {
		this.#users -= 1;
		if (this.#users > 0) {
			return;
		}

		this.#dispose?.();
		this.#dispose = null;
		this.items = [];
		this.loading = true;
	}

	#start(key: string): () => void {
		const ids = key ? key.split(',') : [];
		if (ids.length === 0) {
			this.items = [];
			this.loading = false;
			return () => {};
		}

		let active = true;
		let unsubscribe: UnsubscribeFunc | undefined;
		let refetchTimer: ReturnType<typeof setTimeout> | null = null;
		const filter = recentPlayedMatchesFilter(ids);
		const load = () =>
			app.database.matches
				.getList({ filter, sort: '-createdAt', fields: FIELDS, limit: LIMIT })
				.then((items) => {
					if (active) {
						this.items = items.filter(
							(match) => isMatchFromLast24Hours(match) && matchIncludesSteamIds(match, ids)
						);
					}
				})
				.catch((error) => {
					console.warn('[TODAY-LOBBIES]: list failed:', error);
				});

		// Refetch (at most every 3 s) after local lobby events, so an event the realtime
		// connection missed (e.g. during a reconnect) still shows up.
		const refetch = () => {
			if (refetchTimer) {
				return;
			}

			refetchTimer = setTimeout(() => {
				refetchTimer = null;
				if (active) {
					void load();
				}
			}, REFETCH_MS);
		};
		const offLobbySaved = app.on('lobby.saved', refetch);
		const offMatchResult = app.on('match.result', refetch);
		const offLobbyDestroyed = app.on('lobby.destroyed', refetch);

		this.loading = true;
		void load().finally(() => {
			if (active) {
				this.loading = false;
			}
		});

		app.pocketbase
			.collection('lobbies')
			.subscribe<LobbyMatch>(
				'*',
				(e) => {
					const match = exp(e.record) as MatchExpanded;
					if (!active || !isMatchFromLast24Hours(match) || !matchIncludesSteamIds(match, ids)) {
						return;
					}

					if (e.action === 'create') {
						if (!this.items.some((entry) => entry.id === match.id)) {
							this.items = [...this.items, match];
						}
					} else if (e.action === 'update') {
						this.items = this.items.map((entry) => (entry.id === match.id ? match : entry));
					} else if (e.action === 'delete') {
						this.items = this.items.filter((entry) => entry.id !== match.id);
					}
				},
				{ filter, sort: '-createdAt', fetch }
			)
			.then((off) => {
				if (active) {
					unsubscribe = off;
				} else {
					void off();
				}
			})
			.catch((error) => {
				console.warn('[TODAY-LOBBIES]: subscribe failed:', error);
			});

		return () => {
			active = false;
			if (refetchTimer) {
				clearTimeout(refetchTimer);
			}

			offLobbySaved();
			offMatchResult();
			offLobbyDestroyed();
			void unsubscribe?.();
		};
	}
}

const store = new TodayLobbies();

/**
 * Shared lobbies of the last 24 hours (call during component init). Callers filter further,
 * e.g. to local today or to one account; the subscription stops when the last caller unmounts.
 */
export function useTodayLobbies(): { readonly items: MatchExpanded[]; readonly loading: boolean } {
	$effect(() => {
		store.acquire();
		return () => store.release();
	});

	return {
		get items() {
			return store.items;
		},
		get loading() {
			return store.loading;
		}
	};
}
