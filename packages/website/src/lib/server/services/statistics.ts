import { okAsync, ResultAsync } from 'neverthrow';
import type {
	ReplaySummary,
	StatisticsByMode,
	StatisticsRange
} from '@company-of-heroes/ui/statistics/types';
import { cached } from '../cache';
import { all, chunk, fromPb, sequence, type Task } from '../result';
import {
	buildStatistics,
	summarizeStatistics,
	tallyUploads,
	type DayRange,
	type KeptUploads,
	type StatisticsData,
	type StatisticsRow,
	type UploadRow
} from '../domain/statistics';
import { Service } from './service';

const CACHE_SECONDS = 3600;
const HEADLINE_CACHE_SECONDS = 300;
/** PocketBase's page size limit. */
const PER_PAGE = 1000;
const DAY_MS = 86_400_000;
const FINISHED_LOBBIES = 'needsResult = false && isHidden = false';

/** Parallel requests while reading a view. */
const CONCURRENCY = 6;
/** Characters of PocketBase record ids. */
const ID_CHARS = [...'0123456789abcdefghijklmnopqrstuvwxyz'];

/** A `statistics_matches` row: players as [profile_id, race_id, outcome, alias]. */
type ViewMatch = {
	id: string;
	createdAt: string;
	durationSeconds: number | null;
	title: string;
	memberReplay: string;
	session_id: number;
	map: string;
	matchtype_id: number | null;
	players: [number, number | null, number | null, string][];
};

/** A `statistics_uploads` row (JSON columns may come back null). */
type ViewUpload = Omit<UploadRow, 'ai' | 'names' | 'races'> & {
	ai: number | null;
	names: (string | null)[] | null;
	races: (number | null)[] | null;
};

/** This isolate's copy of the statistics data: a Cache API hit still parses megabytes of JSON. */
let memo: { at: number; data: StatisticsData } | null = null;

/** The days a preset period covers, ending today (UTC). */
function periodDays(period: string): DayRange {
	const days = Number(period);
	if (!Number.isFinite(days)) {
		return { from: null, to: null };
	}

	return { from: new Date(Date.now() - (days - 1) * DAY_MS).toISOString().slice(0, 10), to: null };
}

export class StatisticsService extends Service {
	/** Runs `load` for every prefix, a few at a time. */
	private inBatches<T>(prefixes: string[], load: (prefix: string) => Task<T[]>): Task<T[]> {
		return sequence(chunk(prefixes, CONCURRENCY), (batch) => all(batch.map(load))).map((lists) =>
			lists.flat(2)
		);
	}

	/**
	 * Every record of a view, read in parallel ranges of ids (`id` starts with a prefix) and
	 * handed to `take` page by page. No sort or offset: on a view either one makes SQLite redo
	 * the join for the whole page. A range that fills a page is split into longer prefixes.
	 */
	private eachByIdPrefix<T>(
		collection: string,
		fields: string,
		take: (items: T[]) => void
	): Task<void> {
		const load = (prefix: string): Task<never[]> =>
			fromPb(
				this.pb.collection(collection).getList<T>(1, PER_PAGE, {
					// '{' sorts right after 'z', so this is every id that starts with `prefix`.
					filter: this.pb.filter('id >= {:from} && id < {:to}', {
						from: prefix,
						to: `${prefix}{`
					}),
					fields,
					skipTotal: true
				}),
				'Could not load statistics'
			).andThen(({ items }) => {
				if (items.length < PER_PAGE) {
					take(items);
					return okAsync([]);
				}

				return this.inBatches(
					ID_CHARS.map((char) => prefix + char),
					load
				);
			});
		return this.inBatches(ID_CHARS, load).map(() => undefined);
	}

	private allByIdPrefix<T>(collection: string, fields: string): Task<T[]> {
		const records: T[] = [];
		return this.eachByIdPrefix<T>(collection, fields, (items) => records.push(...items)).map(
			() => records
		);
	}

	/**
	 * Player rows of every finished, decided, visible match (view `statistics_matches`), and
	 * the uploaded replays that lobbies link as their member replay.
	 */
	private rows(): Task<{ rows: StatisticsRow[]; linked: Set<string> }> {
		return this.allByIdPrefix<ViewMatch>(
			'statistics_matches',
			'id,createdAt,durationSeconds,title,memberReplay,session_id,map,matchtype_id,players'
		).map((matches) => ({
			linked: new Set(matches.map((match) => match.memberReplay).filter(Boolean)),
			rows: matches.flatMap((match) =>
				(Array.isArray(match.players) ? match.players : []).map(
					([profileId, raceId, outcome, alias], index): StatisticsRow => ({
						id: `${match.id}:${index}`,
						lobby: match.id,
						session_id: match.session_id,
						map: match.map ?? '',
						outcome,
						race_id: raceId,
						matchtype_id: match.matchtype_id,
						profile_id: profileId,
						alias: alias ?? '',
						createdAt: match.createdAt,
						durationSeconds: match.durationSeconds ?? null,
						lobbyTitle: match.title ?? ''
					})
				)
			)
		}));
	}

	/**
	 * Replay summaries by lobby id (view `statistics_replays`). Without them the statistics
	 * still load, just without doctrines and units.
	 */
	private replays(): Task<Map<string, ReplaySummary>> {
		return this.allByIdPrefix<{ id: string; replayStats: ReplaySummary }>(
			'statistics_replays',
			'id,replayStats'
		)
			.map(
				(records) =>
					new Map(
						records
							.filter((record) => Array.isArray(record.replayStats?.players))
							.map((record) => [record.id, record.replayStats])
					)
			)
			.orElse((error) => {
				console.error('[statistics] replay summaries unavailable', error);
				return okAsync(new Map<string, ReplaySummary>());
			});
	}

	/** Summarized uploaded replays, small rows only (view `statistics_uploads`). Optional. */
	private uploads(): Task<UploadRow[]> {
		return this.allByIdPrefix<ViewUpload>(
			'statistics_uploads',
			'id,gameDate,createdAt,mapFilename,durationInSeconds,isRanked,ai,names,races'
		)
			.map((records) =>
				records.map(
					(record): UploadRow => ({
						...record,
						ai: record.ai === 1,
						names: (record.names ?? []).filter((name): name is string => !!name),
						races: (record.races ?? []).filter((race): race is number => race !== null)
					})
				)
			)
			.orElse((error) => {
				console.error('[statistics] uploaded replays unavailable', error);
				return okAsync<UploadRow[]>([]);
			});
	}

	/**
	 * Adds the picks of the counted uploads, one page at a time: all summaries together are
	 * tens of megabytes. Optional, like the uploads themselves.
	 */
	private tallyUploadReplays(data: StatisticsData, kept: KeptUploads): Task<StatisticsData> {
		if (kept.size === 0) {
			return okAsync(data);
		}

		return this.eachByIdPrefix<{ id: string; replayStats: ReplaySummary }>(
			'statistics_upload_replays',
			'id,replayStats',
			(records) => tallyUploads(data.replays, kept, records)
		)
			.map(() => data)
			.orElse((error) => {
				console.error('[statistics] uploaded replay picks unavailable', error);
				return okAsync(data);
			});
	}

	/** Every finished match (lobbies and uploads) plus replay picks per day: the input of every range. */
	private data(): Task<StatisticsData> {
		if (memo && Date.now() - memo.at < CACHE_SECONDS * 1000) {
			return okAsync(memo.data);
		}

		return cached('statistics:data:v6', CACHE_SECONDS, () =>
			ResultAsync.combine([this.rows(), this.replays(), this.uploads()]).andThen(
				([{ rows, linked }, replays, uploads]) => {
					const { kept, ...data } = buildStatistics(rows, replays, uploads, linked);
					return this.tallyUploadReplays(data, kept);
				}
			)
		).map((data) => {
			memo = { at: Date.now(), data };
			return data;
		});
	}

	/**
	 * Statistics of every mode in a preset period or a custom range of days, optionally on one
	 * map (see `summarizeStatistics`).
	 */
	get(range: StatisticsRange, map: string | null = null): Task<StatisticsByMode> {
		const summarize = (days: DayRange) =>
			this.data().map((data) => summarizeStatistics(data, days, map));
		if ('from' in range) {
			return summarize({ from: range.from, to: range.to });
		}

		return cached(`statistics:period:v7:${range.period}:${map ?? ''}`, CACHE_SECONDS, () =>
			summarize(periodDays(range.period))
		);
	}

	private countLobbies(filter: string): Task<number> {
		return fromPb(
			this.pb.collection('lobbies').getList(1, 1, { filter, fields: 'id' }),
			'Could not count matches'
		).map(({ totalItems }) => totalItems);
	}

	/** Finished matches stored in total and since midnight (UTC). */
	totals(): Task<{ totalMatches: number; matchesToday: number }> {
		return cached('statistics:totals:v2', HEADLINE_CACHE_SECONDS, () => {
			const midnight = `${new Date().toISOString().slice(0, 10)} 00:00:00.000Z`;
			return ResultAsync.combine([
				this.countLobbies(FINISHED_LOBBIES),
				this.countLobbies(
					this.pb.filter(`${FINISHED_LOBBIES} && createdAt >= {:midnight}`, { midnight })
				)
			]).map(([totalMatches, matchesToday]) => ({ totalMatches, matchesToday }));
		});
	}
}
