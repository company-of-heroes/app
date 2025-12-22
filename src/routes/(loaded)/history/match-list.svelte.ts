import { app } from '$core/app';
import { Debounced, watch } from 'runed';
import type { MatchExpanded } from '$core/app/database/lobbies';

const PAGE_SIZE = 50;
const FILTER_DEBOUNCE_MS = 300;

export type FiltersState = {
	scope: 'user' | 'community';
	query: string;
	ranked: { value: boolean; indeterminate: boolean };
	players: string[];
	maps: string[];
};

function escapePocketBaseString(value: string) {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildPocketBaseFilter(filters: FiltersState) {
	const parts: string[] = [];

	const query = filters.query.trim();
	if (query) {
		const q = escapePocketBaseString(query);
		parts.push(`(title ~ "${q}" || result.description ~ "${q}")`);
	}

	if (filters.scope === 'user') {
		parts.push(`user = "${app.features.auth.userId}"`);
	}

	// tri-state:
	// - checked => ranked only
	// - indeterminate => unranked only
	// - neither => all
	if (filters.ranked.value) {
		parts.push('isRanked = true');
	} else if (filters.ranked.indeterminate) {
		parts.push('isRanked = false');
	}

	if (filters.maps.length > 0) {
		const mapExpr = filters.maps.map((m) => `map = "${escapePocketBaseString(m)}"`).join(' || ');
		parts.push(`(${mapExpr})`);
	}

	if (filters.players.length > 0) {
		const playerExpr = filters.players
			.map((p) => `players ~ "${escapePocketBaseString(p)}"`)
			.join(' || ');
		parts.push(`(${playerExpr})`);
	}

	return parts.join(' && ');
}

export type MatchListState = {
	filters: FiltersState;
	matches: MatchExpanded[];
	page: number;
	hasMore: boolean;
};

export class MatchList {
	filters = $state<FiltersState>({
		scope: 'user',
		query: '',
		ranked: { value: false, indeterminate: false },
		players: [],
		maps: []
	});

	matches = $state<MatchExpanded[]>([]);
	page = $state(1);
	hasMore = $state(true);
	isLoading = $state(false);

	#searchId = 0;
	#activeFilter = $state('');

	#debouncedFilter: Debounced<string>;

	constructor() {
		this.#activeFilter = buildPocketBaseFilter($state.snapshot(this.filters));

		this.#debouncedFilter = new Debounced(
			() => buildPocketBaseFilter($state.snapshot(this.filters)),
			FILTER_DEBOUNCE_MS
		);

		watch(
			() => this.#debouncedFilter.current,
			(nextFilter) => {
				if (nextFilter === this.#activeFilter) return;
				this.#resetSearch(nextFilter);
				this.loadMore({ reset: true });
			}
		);

		watch(
			() => this.filters.scope,
			() => {
				this.matches = [];
			}
		);
	}

	capture(): MatchListState {
		return {
			filters: $state.snapshot(this.filters),
			matches: $state.snapshot(this.matches),
			page: this.page,
			hasMore: this.hasMore
		};
	}

	restore(state: MatchListState) {
		this.#searchId += 1;
		this.filters = state.filters;
		this.matches = state.matches;
		this.page = state.page;
		this.hasMore = state.hasMore;
		this.isLoading = false;

		// Sync active state immediately to prevent watchers from triggering a reset
		this.#activeFilter = buildPocketBaseFilter(state.filters);
	}

	#resetSearch(nextFilter: string) {
		this.#searchId += 1;
		this.#activeFilter = nextFilter;
	}

	async loadMore({ reset = false }: { reset?: boolean } = {}) {
		if (this.isLoading && !reset) return;
		if (!this.hasMore && !reset) return;

		this.isLoading = true;
		const currentSearchId = this.#searchId;

		if (reset) {
			this.page = 1;
			this.hasMore = true;
			this.matches = [];
		}

		try {
			const result = await app.database.matches.getPaginated(this.page, PAGE_SIZE, {
				filter: this.#activeFilter,
				sort: '-createdAt'
			});

			if (currentSearchId !== this.#searchId) {
				return;
			}

			this.matches = [...this.matches, ...result.items];

			this.page += 1;
			this.hasMore = result.page < result.totalPages;
		} catch (e) {
			console.error(e);
		} finally {
			if (currentSearchId === this.#searchId) {
				this.isLoading = false;
			}
		}
	}
}
