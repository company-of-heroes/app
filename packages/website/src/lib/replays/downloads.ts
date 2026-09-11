const STORAGE_KEY = 'coh1stats.replayDownloads';
const VISITOR_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Store = {
	visitorId: string;
	matchIds: string[];
};

function persist(store: Store): Store {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
	} catch {
		// Private mode or quota — visitor id still works for this session.
	}

	return store;
}

function newStore(): Store {
	return persist({ visitorId: crypto.randomUUID(), matchIds: [] });
}

function readReplayDownloadStore(): Store {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return newStore();
		}

		const parsed = JSON.parse(raw) as Partial<Store>;
		const visitorId = VISITOR_RE.test(parsed.visitorId || '')
			? parsed.visitorId!
			: crypto.randomUUID();
		const matchIds = Array.isArray(parsed.matchIds)
			? parsed.matchIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
			: [];
		const store = { visitorId, matchIds };
		if (store.visitorId !== parsed.visitorId || store.matchIds.length !== parsed.matchIds?.length) {
			persist(store);
		}

		return store;
	} catch {
		return newStore();
	}
}

export function hasCountedReplayDownload(matchId: string): boolean {
	return readReplayDownloadStore().matchIds.includes(matchId);
}

export function replayDownloadVisitorId(): string {
	return readReplayDownloadStore().visitorId;
}

export function markReplayDownload(matchId: string): string {
	const store = readReplayDownloadStore();
	if (!store.matchIds.includes(matchId)) {
		store.matchIds = [...store.matchIds, matchId];
		persist(store);
	}

	return store.visitorId;
}
