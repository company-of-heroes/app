import { tick } from 'svelte';
import { resource } from 'runed';
import type { HostContext } from '../host/host.context';
import type { LeaderboardStatRow, PlayerEloMap } from '../format/types';
import type { LeaderboardStat } from '../player/types';
import { getStoredEloForLeaderboard } from '../format/player-format';
import {
	DEFAULT_FILTERS,
	DEFAULT_SORT,
	filterStats,
	highlightPeriod,
	isFiltered,
	sortStats,
	steamIdOf,
	type LeaderboardFilters,
	type LeaderboardSort,
	type LeaderboardSortKey
} from './highlights';

/** One ladder as the hosts load it (website service / `api.leaderboards.get`). */
export type LeaderboardBoard = {
	leaderboardId: number;
	stats: LeaderboardStatRow[];
	eloBySteamId: Record<string, PlayerEloMap>;
	baselines?: { day: string | null; week: string | null };
};

export type LeaderboardStateInput = {
	boardId: () => number;
	/** null while the board loads. */
	board: () => LeaderboardBoard | null;
	onBoardChange: (boardId: number) => void;
	host: HostContext;
};

/** The viewer's best ladder line on this board when they are not in the top 200. */
export type LeaderboardOwnStat = LeaderboardStat & { steamId: string };

export const leaderboardRowId = (profileId: number) => `leaderboard-row-${profileId}`;

/** Board data, filters and the viewer's own position, shared by every `Leaderboard.*` piece. */
export class LeaderboardState {
	private readonly input: LeaderboardStateInput;
	filters = $state<LeaderboardFilters>({ ...DEFAULT_FILTERS });
	sort = $state<LeaderboardSort>({ ...DEFAULT_SORT });
	/** Profile id of the row that was just jumped to; it flashes briefly. */
	flashed = $state<number | null>(null);

	readonly boardId: number = $derived.by(() => this.input.boardId());
	readonly board: LeaderboardBoard | null = $derived.by(() => this.input.board());
	readonly loading = $derived(this.board === null || this.board.leaderboardId !== this.boardId);
	readonly stats: LeaderboardStatRow[] = $derived(this.loading ? [] : (this.board?.stats ?? []));
	readonly rows = $derived.by(() =>
		sortStats(filterStats(this.stats, this.filters), this.sort, (stat) => this.elo(stat))
	);
	readonly filtered = $derived(isFiltered(this.filters, this.sort));
	readonly showPodium = $derived(!this.filtered && this.stats.length >= 3);
	readonly tableRows = $derived(this.showPodium ? this.rows.slice(3) : this.rows);
	readonly period = $derived(highlightPeriod(this.stats));

	readonly steamIds: string[] = $derived.by(() => this.input.host.auth.user?.steamIds ?? []);
	/** The viewer's best row in the top 200. */
	readonly ownRow: LeaderboardStatRow | null = $derived(
		this.stats.find((stat) => this.steamIds.includes(steamIdOf(stat))) ?? null
	);

	/** Ladder line of the viewer's best account on this board, when no account made the top 200. */
	readonly #ownStats = resource(
		() => [this.loading, this.ownRow, this.boardId, this.steamIds.join(',')] as const,
		async ([loading, ownRow, boardId]) => {
			if (loading || ownRow || this.steamIds.length === 0) {
				return null;
			}

			const lines = await Promise.all(
				this.steamIds.map(async (steamId) => {
					const stats = await this.input.host.api.players.getStats(steamId).catch(() => null);
					const line = stats?.leaderboardStats.find(
						(stat) => stat.leaderboard_id === boardId && stat.rank > 0
					);
					return line ? { ...line, steamId } : null;
				})
			);
			return (
				lines
					.filter((line): line is LeaderboardOwnStat => line !== null)
					.sort((a, b) => a.rank - b.rank)[0] ?? null
			);
		},
		{ initialValue: null }
	);

	constructor(input: LeaderboardStateInput) {
		this.input = input;
	}

	get ownStat(): LeaderboardOwnStat | null {
		return this.ownRow ? null : (this.#ownStats.current ?? null);
	}

	get ownStatLoading(): boolean {
		return this.#ownStats.loading;
	}

	elo = (stat: LeaderboardStatRow): number | null => {
		const board = this.board;
		return board
			? getStoredEloForLeaderboard(board.eloBySteamId[steamIdOf(stat)], stat.leaderboard_id)
			: null;
	};

	isOwn = (stat: LeaderboardStatRow): boolean => this.steamIds.includes(steamIdOf(stat));

	selectBoard(boardId: number) {
		if (boardId === this.boardId) {
			return;
		}

		this.filters = { ...DEFAULT_FILTERS };
		this.sort = { ...DEFAULT_SORT };
		this.input.onBoardChange(boardId);
	}

	/** Clicking the active column flips it; another column starts best first. */
	toggleSort(key: LeaderboardSortKey) {
		this.sort =
			this.sort.key === key ? { key, reverse: !this.sort.reverse } : { key, reverse: false };
	}

	resetFilters() {
		this.filters = { ...DEFAULT_FILTERS };
		this.sort = { ...DEFAULT_SORT };
	}

	/** Scrolls to a row (clearing filters that hide it) and flashes it. */
	async jumpTo(profileId: number) {
		if (!this.rows.some((stat) => stat.profile.profile_id === profileId)) {
			this.resetFilters();
		}

		await tick();
		document
			.getElementById(leaderboardRowId(profileId))
			?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		this.flashed = profileId;
		setTimeout(() => {
			if (this.flashed === profileId) {
				this.flashed = null;
			}
		}, 2000);
	}
}
