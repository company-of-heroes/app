import { playerIdsFromAst, type FilterAst } from '@company-of-heroes/ui/replay';
import type { FilterOperator, HistorySortField } from '$core/app/database/matches';
import type { CompareFilter, HistoryMatchup, Matches, MatchesFilterState } from './matches.svelte';

export type HistoryTab = 'user' | 'community' | 'replays' | 'member';

const HISTORY_LIST_HREF_KEY = 'coh1stats.historyListHref';

export function tabFromSearch(search: URLSearchParams): HistoryTab {
	const value = search.get('tab');
	if (value === 'community' || value === 'replays' || value === 'member') {
		return value;
	}

	return 'user';
}

function splitCsv(value: string | null): string[] {
	if (!value) {
		return [];
	}

	return value
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
}

function parseOperator(raw: string | null): FilterOperator | null {
	if (raw === 'gt' || raw === 'gte' || raw === 'lt' || raw === 'lte') {
		return raw;
	}

	return null;
}

function parseCompare(search: URLSearchParams, opKey: string, valueKey: string): CompareFilter | null {
	const op = parseOperator(search.get(opKey));
	const value = Number(search.get(valueKey) || '');
	if (!op || !Number.isFinite(value) || value < 0) {
		return null;
	}

	return { op, value };
}

function parseFilterAst(raw: string | null): FilterAst | null {
	if (!raw) {
		return null;
	}

	try {
		return JSON.parse(raw) as FilterAst;
	} catch {
		return null;
	}
}

export function isHistoryListHref(href: string): boolean {
	const path = (href.split('?')[0] ?? '').replace(/\/+$/, '') || '/';
	return path === '/history';
}

export function rememberHistoryListHref(href: string) {
	if (typeof sessionStorage === 'undefined' || !isHistoryListHref(href)) {
		return;
	}

	try {
		sessionStorage.setItem(HISTORY_LIST_HREF_KEY, href.startsWith('/') ? href : `/history`);
	} catch {
		// Private mode or quota.
	}
}

export function rememberedHistoryListHref(): string {
	if (typeof sessionStorage === 'undefined') {
		return '/history';
	}

	try {
		const href = sessionStorage.getItem(HISTORY_LIST_HREF_KEY);
		if (href && isHistoryListHref(href)) {
			return href;
		}
	} catch {
		// Private mode.
	}

	return '/history';
}

export type HistoryListQueryState = {
	page: number;
	sort: HistorySortField;
	sortDir: 'asc' | 'desc';
	filters: MatchesFilterState;
};

export function historyListStateFromMatches(matches: Matches): HistoryListQueryState {
	return {
		page: matches.page,
		sort: matches.sort,
		sortDir: matches.sortDir,
		filters: {
			playerIds: [...matches.filters.playerIds],
			maps: [...matches.filters.maps],
			races: [...matches.filters.races],
			matchups: [...matches.filters.matchups],
			positions: [...matches.filters.positions],
			ranked: matches.filters.ranked,
			pro: matches.filters.pro,
			elo: matches.filters.elo ? { ...matches.filters.elo } : undefined,
			duration: matches.filters.duration ? { ...matches.filters.duration } : undefined,
			filter: matches.filters.filter ?? undefined
		}
	};
}

export function historySearchParams(state: HistoryListQueryState, tab: HistoryTab): URLSearchParams {
	const params = new URLSearchParams();
	if (tab !== 'user') {
		params.set('tab', tab);
	}

	if (state.page > 1) {
		params.set('page', String(state.page));
	}

	if (state.filters.filter != null) {
		params.set('filter', JSON.stringify(state.filters.filter));
	} else {
		if (state.filters.ranked) {
			params.set('ranked', '1');
		}

		if (state.filters.pro) {
			params.set('pro', '1');
		}

		if (state.filters.matchups.length > 0) {
			params.set('modes', state.filters.matchups.join(','));
		}

		if (state.filters.playerIds.length > 0) {
			params.set('players', state.filters.playerIds.join(','));
		}

		if (state.filters.maps.length > 0) {
			params.set('maps', state.filters.maps.join(','));
		}

		if (state.filters.races.length > 0) {
			params.set('races', state.filters.races.join(','));
		}

		if (state.filters.positions.length > 0) {
			params.set('positions', state.filters.positions.join(','));
		}

		if (state.filters.elo) {
			params.set('eloOp', state.filters.elo.op);
			params.set('elo', String(state.filters.elo.value));
		}

		if (state.filters.duration) {
			params.set('durationOp', state.filters.duration.op);
			params.set('duration', String(state.filters.duration.value));
		}
	}

	if (state.sort !== 'createdAt') {
		params.set('sort', state.sort);
	}

	if (state.sortDir === 'asc') {
		params.set('sortDir', 'asc');
	}

	return params;
}

export function historyListHref(state: HistoryListQueryState, tab: HistoryTab): string {
	const search = historySearchParams(state, tab).toString();
	return search ? `/history?${search}` : '/history';
}

export function parseHistoryListState(search: URLSearchParams): HistoryListQueryState {
	const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
	const sortRaw = search.get('sort');
	const sort: HistorySortField =
		sortRaw === 'likeCount' ||
		sortRaw === 'downloadCount' ||
		sortRaw === 'commentCount' ||
		sortRaw === 'createdAt'
			? sortRaw
			: 'createdAt';
	const sortDir = search.get('sortDir') === 'asc' ? 'asc' : 'desc';
	const filter = parseFilterAst(search.get('filter'));
	const matchups = splitCsv(search.get('modes') || search.get('mode')).filter(
		(value): value is HistoryMatchup =>
			value === '1v1' || value === '2v2' || value === '3v3' || value === '4v4'
	);

	const flatPlayerIds = splitCsv(search.get('players'));
	return {
		page,
		sort,
		sortDir,
		filters: {
			// Filter AST owns the query; keep playerIds for row highlighting.
			playerIds: filter != null ? playerIdsFromAst(filter) : flatPlayerIds,
			maps: splitCsv(search.get('maps')),
			races: splitCsv(search.get('races')),
			matchups,
			positions: splitCsv(search.get('positions')),
			ranked: search.get('ranked') === '1',
			pro: search.get('pro') === '1',
			elo: parseCompare(search, 'eloOp', 'elo') ?? undefined,
			duration: parseCompare(search, 'durationOp', 'duration') ?? undefined,
			filter: filter ?? undefined
		}
	};
}

export function historyListStateKey(state: HistoryListQueryState, tab: HistoryTab): string {
	return historyListHref(state, tab);
}
