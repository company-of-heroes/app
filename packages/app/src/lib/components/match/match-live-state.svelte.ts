import { app } from '$core/app/context';
import { resource } from 'runed';
import { useMatch } from './context';

export type MatchLiveCheck = 'live' | 'not_live' | 'unknown';

/** Live vs pending for a saved match that still has `needsResult`. */
export function createMatchLiveState() {
	const match = useMatch();

	const localLive = $derived(
		!!match.needsResult &&
			!!app.lobby &&
			!app.lobby.isReplay &&
			app.lobby.sessionId === match.sessionId
	);

	const remoteLive = resource(
		() =>
			match.needsResult && !localLive && match.id && match.sessionId
				? `${match.id}:${match.sessionId}`
				: null,
		async (key): Promise<MatchLiveCheck> => {
			if (!key) {
				return 'not_live';
			}

			const [id, session] = key.split(':');
			if (!id || !session) {
				return 'not_live';
			}

			try {
				const active = await app.database.lobbiesLive.isActiveForMatch(id, Number(session));
				return active ? 'live' : 'not_live';
			} catch (error) {
				console.warn('[MATCH]: live lobby check failed:', error);
				return 'unknown';
			}
		}
	);

	const liveCheck = $derived.by((): MatchLiveCheck => {
		if (localLive) {
			return 'live';
		}

		return remoteLive.current ?? (remoteLive.loading ? 'unknown' : 'not_live');
	});

	const isLive = $derived(liveCheck === 'live');

	return {
		get match() {
			return match;
		},
		get needsResult() {
			return !!match.needsResult;
		},
		get isLive() {
			return isLive;
		},
		get liveCheck() {
			return liveCheck;
		}
	};
}
