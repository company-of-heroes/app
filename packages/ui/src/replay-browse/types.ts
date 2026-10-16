import type { CommunityMatch, HistoryMatchup } from '../replay/types';

/** The replays page views; `library` is the desktop app's own replay files. */
export type ReplaysView = 'discover' | 'community' | 'mine' | 'library';

export type DiscoverThemeId = 'pro-1v1' | 'big-battles' | 'fast' | 'discussed';

export type ReplayPage = {
	page: number;
	perPage: number;
	totalItems: number;
	totalPages: number;
	items: CommunityMatch[];
};

/** The Discover view, as `GET /api/v1/replays/discover` serves it. */
export type ReplayDiscoverData = {
	featured: CommunityMatch[];
	sections: { id: DiscoverThemeId; items: CommunityMatch[] }[];
	latestShared: ReplayPage;
};

/** The quick filters in the archive's chip bar. */
export type ArchiveQuickFilters = {
	matchups: HistoryMatchup[];
	ranked: boolean;
	pro: boolean;
};
