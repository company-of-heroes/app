import type { PlayerPageData } from '@company-of-heroes/ui/player';
import { resource } from 'runed';
import { app } from '$core/app/context';
import {
	hideMatch,
	isHiddenFromPublic,
	listHiddenKeywordWords,
	listHiddenSessionIds,
	titleMatchesHiddenKeyword,
	unhideMatch
} from '$core/pocketbase/hidden-matches';
import { labelsForSteamId, preloadPlayerLabels } from '$core/pocketbase/player-label-cache.svelte';
import {
	likeCountForSteamId,
	preloadPlayerLikeCounts
} from '$core/pocketbase/player-vote-cache.svelte';
import { steam } from '$core/steam';

/**
 * Desktop-only enrichment for the shared match history: hides matches staff took down,
 * fills in steam avatars / labels / likes, links saved lobbies, and backs the staff hide toggle.
 */
export class MatchHistoryView {
	#getPlayer: () => PlayerPageData | null;
	pendingSessionId = $state<number | null>(null);

	readonly isStaff = $derived(app.account.isStaff);

	readonly #hiddenIds = resource(
		() => true,
		() => listHiddenSessionIds()
	);

	readonly #hiddenWords = resource(
		() => true,
		() => listHiddenKeywordWords()
	);

	readonly #ordered = $derived.by(() => {
		const player = this.#getPlayer();
		return player
			? [...player.matchHistory].sort((a, b) => b.completiontime - a.completiontime)
			: [];
	});

	readonly #visible = $derived.by(() => {
		if (this.isStaff) {
			return this.#ordered;
		}

		const ids = this.#hiddenIds.current;
		const words = this.#hiddenWords.current;
		if (ids == null || words == null || this.#hiddenIds.error || this.#hiddenWords.error) {
			return [];
		}

		return this.#ordered.filter(
			(match) => !ids.has(match.id) && !titleMatchesHiddenKeyword(match.description, words)
		);
	});

	readonly #steamIdsKey = $derived(
		[
			...new Set(
				this.#visible.flatMap((match) =>
					match.players.map((p) => p.steamId).filter((id): id is string => Boolean(id))
				)
			)
		]
			.sort()
			.join(',')
	);

	readonly #avatars = resource(
		() => this.#steamIdsKey,
		async (key) => {
			if (!key) {
				return { key, map: new Map<string, string>() };
			}

			const profiles = await steam.getUserProfiles(key.split(',')).catch((error) => {
				console.warn('[MATCH-HISTORY]: steam avatar lookup failed:', error);
				return [];
			});

			return {
				key,
				map: new Map(
					profiles
						.filter((profile) => profile.avatarfull)
						.map((profile) => [profile.steamid, profile.avatarfull])
				)
			};
		}
	);

	readonly #savedBySession = resource(
		() => this.#ordered.map((match) => match.id).join(','),
		(key) => {
			if (!key) {
				return Promise.resolve(new Map<number, string>());
			}

			return app.database.matches.getIdsBySessionIds(key.split(',').map(Number)).catch((error) => {
				console.warn('[MATCH-HISTORY]: saved match lookup failed:', error);
				return new Map<number, string>();
			});
		}
	);

	/** Hidden filters and avatars are in, so the list renders once instead of filling in. */
	readonly ready = $derived(
		(this.isStaff ||
			(this.#hiddenIds.current != null && this.#hiddenWords.current != null) ||
			Boolean(this.#hiddenIds.error || this.#hiddenWords.error)) &&
			this.#avatars.current?.key === this.#steamIdsKey
	);

	/** The page player with the match history replaced by the enriched, visible matches. */
	readonly player = $derived.by((): PlayerPageData | null => {
		const player = this.#getPlayer();
		if (!player) {
			return null;
		}

		const avatars = this.#avatars.current?.map ?? new Map<string, string>();
		const saved = this.#savedBySession.current;
		return {
			...player,
			matchHistory: this.#visible.map((match) => ({
				...match,
				lobbyId: match.lobbyId ?? saved?.get(match.id) ?? null,
				players: match.players.map((matchPlayer) => ({
					...matchPlayer,
					avatarUrl:
						matchPlayer.avatarUrl ??
						(matchPlayer.steamId ? (avatars.get(matchPlayer.steamId) ?? null) : null),
					labels: matchPlayer.labels ?? labelsForSteamId(matchPlayer.steamId),
					likeCount: matchPlayer.likeCount ?? likeCountForSteamId(matchPlayer.steamId) ?? undefined
				}))
			}))
		};
	});

	constructor(getPlayer: () => PlayerPageData | null) {
		this.#getPlayer = getPlayer;

		$effect(() => {
			if (!this.#steamIdsKey) {
				return;
			}

			const ids = this.#steamIdsKey.split(',');
			preloadPlayerLabels(ids);
			preloadPlayerLikeCounts(ids);
		});
	}

	isManuallyHidden(sessionId: number): boolean {
		return this.#hiddenIds.current?.has(sessionId) ?? false;
	}

	isHidden(sessionId: number, description: string | undefined): boolean {
		return isHiddenFromPublic(
			sessionId,
			description,
			this.#hiddenIds.current,
			this.#hiddenWords.current
		);
	}

	async setHidden(sessionId: number, hidden: boolean): Promise<void> {
		this.pendingSessionId = sessionId;
		try {
			if (hidden) {
				await hideMatch(sessionId, app.account.userId);
			} else {
				await unhideMatch(sessionId);
			}

			const next = new Set(this.#hiddenIds.current ?? []);
			if (hidden) {
				next.add(sessionId);
			} else {
				next.delete(sessionId);
			}

			this.#hiddenIds.mutate(next);
		} finally {
			this.pendingSessionId = null;
		}
	}
}
