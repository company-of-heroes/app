import { resetReplayMetadata } from '@fknoobs/replay-parser';
import { err, errAsync, ok, okAsync, ResultAsync, type Result } from 'neverthrow';
import { cached } from '../cache';
import { notFound, rateLimited, upstream, type AppError } from '../errors';
import { fromAsync, fromPb, type Task } from '../result';
import type { HistoryRow } from '../domain/history-rows';
import {
	DISCOVER_THEMES,
	fillTheme,
	fitsTheme,
	pickFeatured,
	themeFilter,
	type DiscoverThemeId
} from '../domain/replay-discover';
import type { HistoryViewer } from './match-history';
import type { MatchDetail, MatchViewer } from './matches';
import type { MemberReplayPage, MemberReplayView } from './member-replays';
import { Service } from './service';

export type ReplayFile = {
	body: ReadableStream<Uint8Array> | Uint8Array;
	contentType: string;
	filename: string;
};

export type AnyReplay = (MatchDetail & { kind: 'match' }) | MemberReplayView;

/** A list row of either kind, as `ReplayList` / `Replay.Card` show it. */
export type ReplayRow = HistoryRow | MemberReplayView;

/** Fewer top replays than this in the window widens it to `TOP_FALLBACK_DAYS`. */
const TOP_MIN_ITEMS = 3;
const TOP_FALLBACK_DAYS = 30;

/** Discover: the featured window, its fallback, and how many rows each part reads. */
const DISCOVER_DAYS = 7;
const DISCOVER_FALLBACK_DAYS = 30;
const DISCOVER_MEMBER_POOL = 100;
const DISCOVER_MATCH_POOL = 60;
const DISCOVER_THEME_POOL = 16;
export const DISCOVER_LATEST = 12;
/** A theme row with fewer items is left out. */
const DISCOVER_MIN_THEME = 2;

/** Share suggestions: the viewer's own games of the last two weeks, at most four. */
const SHARE_CANDIDATE_DAYS = 14;
const SHARE_CANDIDATE_POOL = 20;
const SHARE_CANDIDATES = 4;

export type DiscoverSection = { id: DiscoverThemeId; items: ReplayRow[] };

export type ReplayDiscover = {
	featured: ReplayRow[];
	sections: DiscoverSection[];
	latestShared: MemberReplayPage;
};

const emptyMemberPage = (perPage: number): MemberReplayPage => ({
	page: 1,
	perPage,
	totalItems: 0,
	totalPages: 0,
	items: []
});

/** Replay URLs per kind in the sitemap (PocketBase's page cap). */
const SITEMAP_PER_KIND = 1000;

export type SitemapReplay = { id: string; createdAt: string };

/** PocketBase datetime `days` ago. */
function daysAgo(days: number): string {
	return new Date(Date.now() - days * 86_400_000).toISOString().replace('T', ' ');
}

function checkResponse(response: Response): Result<Response, AppError> {
	if (response.status === 429) {
		return err(
			rateLimited(
				'Too many download requests. Try again in a moment.',
				Number(response.headers.get('retry-after')) || 30
			)
		);
	}

	if (!response.ok || !response.body) {
		return err(
			response.status === 404 ? notFound('Replay not found') : upstream('Failed to download replay')
		);
	}

	return ok(response);
}

/** Replay pages take either a community match id or a member replay id. */
export class ReplaysService extends Service {
	/** Whichever of the two exists; a real failure wins over "not found". */
	getAny(id: string, viewer: MatchViewer): Task<AnyReplay> {
		const settle = <T>(task: Task<T>) => ResultAsync.fromSafePromise(Promise.resolve(task));
		return ResultAsync.combine([
			settle(
				this.services.matches
					.get(id, viewer)
					.map((detail): AnyReplay => ({ ...detail, kind: 'match' }))
			),
			settle(this.services.memberReplays.get(id, viewer).map((replay): AnyReplay => replay))
		]).andThen(([match, member]) => {
			if (match.isOk()) {
				return ok(match.value);
			}

			if (member.isOk()) {
				return ok(member.value);
			}

			const failure = [match.error, member.error].find((error) => error.status !== 404);
			return err(failure ?? notFound('That replay is not available.'));
		});
	}

	/**
	 * Most downloaded member replays and community matches of the last `days`, merged.
	 * A quiet window widens to a month so the spotlight is never near-empty.
	 */
	top({ days, limit }: { days: number; limit: number }): Task<ReplayRow[]> {
		return cached(`replays:top:${days}:${limit}`, 300, () =>
			this.topSince(daysAgo(days), limit).andThen((rows) =>
				rows.length < TOP_MIN_ITEMS && days < TOP_FALLBACK_DAYS
					? this.topSince(daysAgo(TOP_FALLBACK_DAYS), limit)
					: okAsync(rows)
			)
		);
	}

	private topSince(since: string, limit: number): Task<ReplayRow[]> {
		const sort = { sort: 'downloadCount', sortDir: 'desc' } as const;
		return ResultAsync.combine([
			this.services.memberReplays.list(
				{
					page: 1,
					perPage: limit,
					ranked: false,
					title: '',
					maps: [],
					filter: null,
					since,
					...sort
				},
				null
			),
			this.services.matchHistory.list(
				{
					scope: 'community',
					page: 1,
					perPage: limit,
					filter: null,
					includeSkirmish: false,
					since,
					...sort
				},
				null
			)
		]).map(([members, matches]) =>
			[...members.items, ...matches.items]
				.sort(
					(a, b) =>
						(b.downloadCount ?? 0) - (a.downloadCount ?? 0) ||
						(b.likeCount ?? 0) - (a.likeCount ?? 0) ||
						b.createdAt.localeCompare(a.createdAt)
				)
				.slice(0, limit)
		);
	}

	/**
	 * The Discover view: featured hero, theme rows and the newest shared replays.
	 * Each part loads on its own; a failing part is logged and left empty.
	 */
	discover(): Task<ReplayDiscover> {
		return cached('replays:discover', 300, () =>
			ResultAsync.combine([
				this.soft(this.recentMembers(), [], 'members'),
				this.soft(this.communityPool(), [], 'community pool'),
				ResultAsync.combine(
					DISCOVER_THEMES.map((theme) => this.soft(this.themeMatches(theme), [], theme))
				),
				this.soft(this.latestShared(), emptyMemberPage(DISCOVER_LATEST), 'latest shared')
			]).map(([members, matches, themeMatches, latestShared]) => {
				const recent = daysAgo(DISCOVER_DAYS);
				const pool = [...members, ...matches];
				const thisWeek = pickFeatured(pool.filter((row) => row.createdAt >= recent));
				const featured = thisWeek.length >= TOP_MIN_ITEMS ? thisWeek : pickFeatured(pool);
				const taken = new Set(featured.map((row) => row.id));
				const sections = DISCOVER_THEMES.map((theme, index) => ({
					id: theme,
					items: fillTheme<ReplayRow>(this.membersFor(members, theme), themeMatches[index], taken)
				})).filter((section) => section.items.length >= DISCOVER_MIN_THEME);
				return { featured, sections, latestShared };
			})
		);
	}

	private soft<T>(task: Task<T>, fallback: T, part: string): Task<T> {
		return task.orElse((error) => {
			console.error(`[replays] discover ${part} failed`, error);
			return ok(fallback);
		});
	}

	/** Shared replays of the fallback window, newest first. */
	private recentMembers(): Task<MemberReplayView[]> {
		return this.services.memberReplays
			.list(
				{
					page: 1,
					perPage: DISCOVER_MEMBER_POOL,
					ranked: false,
					title: '',
					maps: [],
					filter: null,
					since: daysAgo(DISCOVER_FALLBACK_DAYS),
					sort: 'createdAt',
					sortDir: 'desc'
				},
				null
			)
			.map((page) => page.items);
	}

	/** Most downloaded community matches of the fallback window. */
	private communityPool(): Task<HistoryRow[]> {
		return this.services.matchHistory
			.list(
				{
					scope: 'community',
					page: 1,
					perPage: DISCOVER_MATCH_POOL,
					filter: null,
					includeSkirmish: false,
					since: daysAgo(DISCOVER_FALLBACK_DAYS),
					sort: 'downloadCount',
					sortDir: 'desc'
				},
				null
			)
			.map((page) => page.items);
	}

	/** Community matches for one theme row. */
	private themeMatches(theme: DiscoverThemeId): Task<HistoryRow[]> {
		const discussed = theme === 'discussed';
		return this.services.matchHistory
			.list(
				{
					scope: 'community',
					page: 1,
					perPage: DISCOVER_THEME_POOL,
					filter: themeFilter(theme),
					includeSkirmish: false,
					since: daysAgo(DISCOVER_FALLBACK_DAYS),
					sort: discussed ? 'commentCount' : 'createdAt',
					sortDir: 'desc'
				},
				null
			)
			.map((page) =>
				page.items.filter((row) => row.hasReplay && (!discussed || row.commentCount > 0))
			);
	}

	/** Shared replays that fit a theme; the most discussed first for `discussed`. */
	private membersFor(members: MemberReplayView[], theme: DiscoverThemeId): MemberReplayView[] {
		const fitting = members.filter((row) => fitsTheme(row, theme));
		return theme === 'discussed'
			? fitting.sort((a, b) => b.commentCount - a.commentCount)
			: fitting;
	}

	private latestShared(): Task<MemberReplayPage> {
		return this.services.memberReplays.list(
			{
				page: 1,
				perPage: DISCOVER_LATEST,
				ranked: false,
				title: '',
				maps: [],
				filter: null,
				sort: 'createdAt',
				sortDir: 'desc'
			},
			null
		);
	}

	/**
	 * The viewer's own recent games with a replay that nobody has shared yet, for the
	 * "share your latest matches" strip.
	 */
	shareCandidates(viewer: NonNullable<HistoryViewer>): Task<HistoryRow[]> {
		const since = daysAgo(SHARE_CANDIDATE_DAYS);
		return this.services.matchHistory
			.list(
				{
					scope: 'user',
					page: 1,
					perPage: SHARE_CANDIDATE_POOL,
					filter: null,
					includeSkirmish: false,
					sort: 'createdAt',
					sortDir: 'desc'
				},
				viewer
			)
			.map((page) => page.items.filter((row) => row.hasReplay && row.createdAt >= since))
			.andThen((rows) => this.unshared(rows))
			.map((rows) => rows.slice(0, SHARE_CANDIDATES));
	}

	/** Drops games that already have a published member replay. */
	private unshared(rows: HistoryRow[]): Task<HistoryRow[]> {
		if (rows.length === 0) {
			return okAsync(rows);
		}

		const ids = rows.map((row) => this.pb.filter('id = {:id}', { id: row.id })).join(' || ');
		return fromPb(
			this.pb.collection('lobbies').getFullList<{ id: string }>({
				filter: `memberReplay != '' && (${ids})`,
				fields: 'id'
			}),
			'Could not load your matches'
		).map((shared) => {
			const published = new Set(shared.map((record) => record.id));
			return rows.filter((row) => !published.has(row.id));
		});
	}

	/** Newest public replays with this player: community matches and member uploads, merged. */
	forPlayer({
		steamId,
		profileId,
		limit
	}: {
		steamId: string;
		profileId: number;
		limit: number;
	}): Task<ReplayRow[]> {
		const sort = { sort: 'createdAt', sortDir: 'desc' } as const;
		return ResultAsync.combine([
			this.services.memberReplays.list(
				{
					page: 1,
					perPage: limit,
					ranked: false,
					title: '',
					maps: [],
					filter: null,
					steamId,
					...sort
				},
				null
			),
			profileId > 0
				? this.services.matchHistory
						.list(
							{
								scope: 'community',
								page: 1,
								perPage: limit,
								filter: { field: 'playerId', op: 'in', value: [profileId] },
								includeSkirmish: false,
								...sort
							},
							null
						)
						.map((page) => page.items)
				: okAsync([])
		]).map(([members, matches]) =>
			[...members.items, ...matches]
				.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
				.slice(0, limit)
		);
	}

	/** Newest public member replays and community matches, for the sitemap. */
	sitemapEntries(): Task<SitemapReplay[]> {
		const list = (collection: string, filter: string) =>
			fromPb(
				this.pb.collection(collection).getList<SitemapReplay>(1, SITEMAP_PER_KIND, {
					filter,
					sort: '-createdAt',
					fields: 'id,createdAt',
					skipTotal: true
				}),
				'Could not load replays'
			).map((page) => page.items);
		return cached('sitemap:replays', 3600, () =>
			ResultAsync.combine([
				list('replays', "visibility = 'member' && file != ''"),
				list(
					'lobbies',
					"isCommunity = true && needsResult = false && isHidden = false && title != 'Skirmish'"
				)
			]).map(([members, matches]) => [...members, ...matches])
		);
	}

	/**
	 * The .rec file of a visible match or member replay. `stripMetadata` resets the
	 * embedded Steam ids/metadata, for downloads that should load in any game.
	 */
	file(id: string, viewer: MatchViewer, { stripMetadata = false } = {}): Task<ReplayFile> {
		return this.getAny(id, viewer).andThen((replay) => {
			if (!replay.replay) {
				return errAsync(notFound('Replay not found'));
			}

			const collection = replay.kind === 'member' ? 'replays' : 'lobbies';
			const filename =
				('filename' in replay && replay.filename) || replay.replay || `${replay.id}.rec`;
			return fromAsync(
				this.fileFetch(
					this.pb.files.getURL({ id: replay.id, collectionName: collection }, replay.replay)
				),
				'Failed to download replay',
				502
			)
				.andThen(checkResponse)
				.andThen((response) =>
					(stripMetadata
						? fromAsync(response.arrayBuffer(), 'Failed to download replay', 502).map(
								(buffer): ReplayFile['body'] => resetReplayMetadata(new Uint8Array(buffer))
							)
						: okAsync<ReplayFile['body']>(response.body!)
					).map((body) => ({
						body,
						contentType: response.headers.get('content-type') ?? 'application/octet-stream',
						filename
					}))
				);
		});
	}
}
