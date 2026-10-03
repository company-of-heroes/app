import { resetReplayMetadata } from '@fknoobs/replay-parser';
import { err, errAsync, ok, okAsync, ResultAsync, type Result } from 'neverthrow';
import { cached } from '../cache';
import { notFound, rateLimited, upstream, type AppError } from '../errors';
import { fromAsync, fromPb, type Task } from '../result';
import type { HistoryRow } from '../domain/history-rows';
import type { MatchDetail, MatchViewer } from './matches';
import type { MemberReplayView } from './member-replays';
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
