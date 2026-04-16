import { app } from '$core/app/context';
import { Debounced, watch } from 'runed';
import type { ReplaysExpanded } from '$core/app/database/replays';

const PAGE_SIZE = 50;
const FILTER_DEBOUNCE_MS = 300;

export type FiltersState = {
	query: string;
	players: string[];
	maps: string[];
	ranked: { value: boolean; indeterminate: boolean };
	vp: { value: boolean; indeterminate: boolean };
	highResources: { value: boolean; indeterminate: boolean };
	sort: {
		duration: '-durationInSeconds' | 'durationInSeconds' | '';
		gameDate: '-gameDate' | 'gameDate' | '';
	};
};

function escapePocketBaseString(value: string) {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildPocketBaseFilter(filters: FiltersState) {
	const parts: string[] = [`createdBy = "${app.features.auth.userId}"`];

	const query = filters.query.trim();
	if (query) {
		const q = escapePocketBaseString(query);
		parts.push(`title ~ "${q}"`);
	}

	if (filters.ranked.value) parts.push('isRanked = true');
	else if (filters.ranked.indeterminate) parts.push('isRanked = false');

	if (filters.vp.value) parts.push('isVpGame = true');
	else if (filters.vp.indeterminate) parts.push('isVpGame = false');

	if (filters.highResources.value) parts.push('isHighResources = true');
	else if (filters.highResources.indeterminate) parts.push('isHighResources = false');

	if (filters.maps.length > 0) {
		const mapExpr = filters.maps
			.map((m) => `mapName = "${escapePocketBaseString(m)}"`)
			.join(' || ');
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

function buildPocketBaseSort(sort: FiltersState['sort']) {
	const parts: string[] = [];
	if (sort.duration) parts.push(sort.duration);
	if (sort.gameDate) parts.push(sort.gameDate);

	if (parts.length === 0) return '-gameDate';
	return parts.join(',');
}

export type ReplayListState = {
	filters: FiltersState;
	replays: ReplaysExpanded[];
	page: number;
	hasMore: boolean;
};

export class ReplayList {
	filters = $state<FiltersState>({
		query: '',
		players: [],
		maps: [],
		ranked: { value: false, indeterminate: false },
		vp: { value: false, indeterminate: false },
		highResources: { value: false, indeterminate: false },
		sort: {
			duration: '',
			gameDate: '-gameDate'
		}
	});

	replays = $state<ReplaysExpanded[]>([]);
	page = $state(1);
	hasMore = $state(true);
	isLoading = $state(false);

	#searchId = 0;
	#activeFilter = $state('');
	#activeSort = $state('');

	#debouncedFilter: Debounced<string>;

	constructor() {
		this.#activeFilter = buildPocketBaseFilter($state.snapshot(this.filters));
		this.#activeSort = buildPocketBaseSort($state.snapshot(this.filters.sort));

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

		const sortString = $derived(buildPocketBaseSort(this.filters.sort));
		watch(
			() => sortString,
			(nextSort) => {
				if (nextSort === this.#activeSort) return;
				this.#resetSort(nextSort);
				this.loadMore({ reset: true });
			}
		);
	}

	capture(): ReplayListState {
		return {
			filters: $state.snapshot(this.filters),
			replays: $state.snapshot(this.replays),
			page: this.page,
			hasMore: this.hasMore
		};
	}

	restore(state: ReplayListState) {
		this.#searchId += 1;
		this.filters = state.filters;
		this.replays = state.replays;
		this.page = state.page;
		this.hasMore = state.hasMore;
		this.isLoading = false;

		// Sync active state immediately to prevent watchers from triggering a reset
		this.#activeFilter = buildPocketBaseFilter(state.filters);
		this.#activeSort = buildPocketBaseSort(state.filters.sort);
	}

	#resetSearch(nextFilter: string) {
		this.#searchId += 1;
		this.#activeFilter = nextFilter;
	}

	#resetSort(nextSort: string) {
		this.#searchId += 1;
		this.#activeSort = nextSort;
	}

	async loadMore({ reset = false }: { reset?: boolean } = {}) {
		if (this.isLoading && !reset) return;
		if (!this.hasMore && !reset) return;

		this.isLoading = true;
		const currentSearchId = this.#searchId;

		if (reset) {
			this.page = 1;
			this.hasMore = true;
			this.replays = [];
		}

		try {
			const result = await app.database.replays.getPaginated(this.page, PAGE_SIZE, {
				filter: this.#activeFilter,
				sort: this.#activeSort
			});

			if (currentSearchId !== this.#searchId) {
				return;
			}

			this.replays = [...this.replays, ...result.items];

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
