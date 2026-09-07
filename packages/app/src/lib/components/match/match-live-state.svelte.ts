import { app } from '$core/app/context';
import { resource } from 'runed';
import { useMatch } from './context';

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
		async (key) => {
			if (!key) {
				return false;
			}

			const [id, session] = key.split(':');
			if (!id || !session) {
				return false;
			}

			try {
				return await app.database.lobbiesLive.isActiveForMatch(id, Number(session));
			} catch (error) {
				console.warn('[MATCH]: live lobby check failed:', error);
				return false;
			}
		}
	);

	const isLive = $derived(localLive || !!remoteLive.current);

	return {
		get match() {
			return match;
		},
		get needsResult() {
			return !!match.needsResult;
		},
		get isLive() {
			return isLive;
		}
	};
}
