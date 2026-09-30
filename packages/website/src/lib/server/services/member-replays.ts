import { err, errAsync, ok, okAsync, ResultAsync, type Result } from 'neverthrow';
import type { ReplaysQuery } from '@company-of-heroes/api';
import { cached } from '../cache';
import { RELIC_BASE } from '../clients/relic';
import { badRequest, conflict, forbidden, notFound, type AppError } from '../errors';
import { ensure, fromAsync, fromPb, pbMaybe, type Task } from '../result';
import {
	buildStatsSnapshot,
	displayMapName,
	livePlayersFromSnapshot,
	normalizeSteamId,
	parseJsonList,
	parseSnapshot,
	resultPlayers,
	snapshotNeedsRepair,
	toCommunityPlayers,
	type ReplayRosterPlayer,
	type SteamLadder,
	type StatsSnapshot
} from '../domain/member-replays';
import { profileFromPersonalStat, type RelicPersonalStat } from '../domain/relic-matches';
import { MAX_REPLAY_BYTES, MIN_REPLAY_BYTES, replayFileName } from '../domain/lobby-writes';
import {
	publishDuration,
	rosterFromMatch,
	snapshotFromResult,
	type MemberUpdate,
	type MemberUpload,
	type PublishFromMatch
} from '../domain/member-replay-writes';
import { Service } from './service';

type ReplayRecord = {
	id: string;
	title: string;
	description: string;
	isRanked: boolean;
	createdAt: string;
	created?: string;
	durationInSeconds: number;
	likeCount: number;
	downloadCount: number;
	commentCount: number;
	file: string;
	filename: string;
	players: unknown;
	statsSnapshot: unknown;
	mapName: string;
	mapFilename: string;
	visibility: 'member' | 'private' | 'deleted';
	createdBy: string;
	isVpGame: boolean;
	isHighResources: boolean;
	isRandomStart: boolean;
	vpCount: number;
	gameDate: string;
	messages: unknown;
	expand?: { createdBy?: { id: string; name?: string; email?: string } };
};

export type MemberReplayViewer = { id: string; isStaff: boolean } | null;

export type MemberReplayListQuery = {
	page: number;
	perPage: number;
	ranked: boolean;
	title: string;
	maps: string[];
	/** Only `ranked` and `map` leaves apply to member replays. */
	filter: unknown;
	sort: 'createdAt' | 'likeCount' | 'downloadCount' | 'commentCount';
	sortDir: 'asc' | 'desc';
};

/** The replays page query (URL state) as a member-replay list request. */
export function memberQueryFromReplaysQuery(
	query: ReplaysQuery,
	perPage: number
): MemberReplayListQuery {
	return {
		page: query.page,
		perPage,
		ranked: query.ranked,
		title: '',
		maps: query.maps,
		filter: query.filter ?? null,
		sort: query.sort,
		sortDir: query.sortDir
	};
}

const LIST_FIELDS =
	'id,title,description,isRanked,createdAt,durationInSeconds,likeCount,downloadCount,commentCount,file,players,statsSnapshot,mapName,mapFilename,visibility,createdBy,expand.createdBy.id,expand.createdBy.name,expand.createdBy.email';

const replayNotFound = () => notFound('Replay not found');

function steamIdsOfRoster(roster: ReplayRosterPlayer[]): string[] {
	return roster
		.map((player) => normalizeSteamId(player.steamId))
		.filter((id): id is string => !!id);
}

function uploaderOf(record: ReplayRecord) {
	const user = record.expand?.createdBy;
	if (!user) {
		return null;
	}

	const name = user.name?.trim();
	const email = user.email?.trim();
	return { id: user.id, alias: name || (email ? email.split('@')[0] || email : user.id) };
}

/** A replay as the site and apps show it; `profileIds` maps roster Steam ids to Relic profiles. */
function toView(
	record: ReplayRecord,
	snapshot: StatsSnapshot | null,
	detail: boolean,
	profileIds: Map<string, number>
) {
	const roster = parseJsonList<ReplayRosterPlayer>(record.players);
	const players = toCommunityPlayers(roster, profileIds);
	const livePlayers = livePlayersFromSnapshot(snapshot, players);
	players.forEach((player, i) => {
		// Keep stats for hover previews; list UI still hides rank badges when unranked.
		if (livePlayers[i]?.stats) {
			player.stats = livePlayers[i].stats;
		}
	});

	const duration = Number(record.durationInSeconds) || 0;
	const results = resultPlayers(snapshot);
	const mapFilename = record.mapFilename || '';
	return {
		id: record.id,
		kind: 'member' as const,
		map: displayMapName(record.mapName, mapFilename),
		title: record.title || '',
		description: record.description || '',
		isRanked: record.isRanked,
		createdAt: record.createdAt || record.created || '',
		durationSeconds: duration > 0 ? duration : null,
		likeCount: record.likeCount || 0,
		downloadCount: record.downloadCount || 0,
		commentCount: record.commentCount || 0,
		hasReplay: true,
		replay: record.file || '',
		players,
		livePlayers,
		result:
			duration > 0 || results.length > 0
				? {
						matchtype_id:
							snapshot?.matchtype_id !== undefined && snapshot?.matchtype_id !== null
								? Number(snapshot.matchtype_id)
								: undefined,
						startgametime: 0,
						completiontime: duration > 0 ? duration : Number(snapshot?.completiontime) || 0,
						players: results
					}
				: null,
		uploadedBy: uploaderOf(record),
		visibility: record.visibility || ('member' as const),
		...(detail
			? {
					mapFilename,
					filename: record.filename || '',
					isVpGame: record.isVpGame,
					isHighResources: record.isHighResources,
					isRandomStart: record.isRandomStart,
					vpCount: Number(record.vpCount) || 0,
					gameDate: record.gameDate || '',
					messages: parseJsonList(record.messages),
					roster
				}
			: {})
	};
}

export type MemberReplayView = ReturnType<typeof toView>;

export type MemberReplayPage = {
	page: number;
	perPage: number;
	totalItems: number;
	totalPages: number;
	items: MemberReplayView[];
};

function checkFile(file: Blob): Result<void, AppError> {
	if (file.size < MIN_REPLAY_BYTES) {
		return err(badRequest('Replay file is empty or corrupt.'));
	}

	if (file.size > MAX_REPLAY_BYTES) {
		return err(badRequest('Replay file is too large.'));
	}

	return ok(undefined);
}

type PublishableLobby = {
	id: string;
	collectionId: string;
	user: string;
	memberReplay: string;
	replay: string;
	map: string;
	title: string;
	isRanked: boolean;
	players: unknown;
	result: unknown;
	durationSeconds: number;
	createdAt: string;
};
export class MemberReplaysService extends Service {
	private get replays() {
		return this.pb.collection('replays');
	}

	/** Relic profile id per Steam id in the roster (from stored ratings). */
	private profileIdsOf(roster: ReplayRosterPlayer[]): Task<Map<string, number>> {
		return this.services.playerInfo
			.ratings(steamIdsOfRoster(roster))
			.map(
				(ratings) => new Map([...ratings].map(([steamId, rating]) => [steamId, rating.profileId]))
			);
	}

	/** Stored ratings + current Relic ladder per Steam id, for freezing a snapshot. */
	private laddersFor(roster: ReplayRosterPlayer[]): Task<Map<string, SteamLadder>> {
		const steamIds = [...new Set(steamIdsOfRoster(roster))];
		const urls = steamIds.map(
			(steamId) =>
				`${RELIC_BASE}/community/leaderboard/getpersonalstat?title=coh1&profile_names=${encodeURIComponent(JSON.stringify([`/steam/${steamId}`]))}`
		);
		return ResultAsync.combine([
			this.services.playerInfo.ratings(steamIds),
			// Without Relic the snapshot still holds the stored ratings.
			this.relic.getMany<RelicPersonalStat>(urls).orElse(() => ok([]))
		]).map(([ratings, relicResults]) => {
			const ladders = new Map<string, SteamLadder>();
			steamIds.forEach((steamId, i) => {
				const result = relicResults[i];
				const relicProfile = result?.ok
					? profileFromPersonalStat(result.body, (member) => member.name === `/steam/${steamId}`)
					: null;
				ladders.set(steamId, {
					rating: ratings.get(steamId),
					relic: relicProfile
						? {
								profile_id: relicProfile.profile_id,
								country: relicProfile.country ?? undefined,
								leaderboardStats: relicProfile.leaderboardStats
							}
						: undefined
				});
			});
			return ladders;
		});
	}

	snapshotOf(
		roster: ReplayRosterPlayer[],
		isRanked: boolean,
		duration: number
	): Task<StatsSnapshot> {
		return this.laddersFor(roster).map((ladders) =>
			buildStatsSnapshot(roster, isRanked, duration, ladders)
		);
	}

	private serialize(
		record: ReplayRecord,
		snapshot: StatsSnapshot | null,
		detail: boolean
	): Task<MemberReplayView> {
		return this.profileIdsOf(parseJsonList<ReplayRosterPlayer>(record.players)).map((profileIds) =>
			toView(record, snapshot, detail, profileIds)
		);
	}

	/** The catalog filter: visibility plus the query's AST (or its flat fields). */
	private listFilter(query: MemberReplayListQuery, viewer: MemberReplayViewer): string {
		const filters = [
			viewer?.isStaff
				? "(visibility = 'member' || visibility = 'deleted')"
				: "visibility = 'member'"
		];
		const ast = this.filterFromAst(query.filter);
		if (ast !== null) {
			if (ast) {
				filters.push(ast);
			}
		} else {
			if (query.ranked) {
				filters.push('isRanked = true');
			}

			if (query.title) {
				filters.push(this.pb.filter('title ~ {:title}', { title: query.title }));
			}

			if (query.maps.length > 0) {
				filters.push(
					`(${query.maps.map((map) => this.pb.filter('mapName = {:map}', { map })).join(' || ')})`
				);
			}
		}

		return filters.join(' && ');
	}

	/** The public catalog; staff also see soft-deleted replays. */
	list(query: MemberReplayListQuery, viewer: MemberReplayViewer): Task<MemberReplayPage> {
		return fromPb(
			this.replays.getList<ReplayRecord>(query.page, query.perPage, {
				filter: this.listFilter(query, viewer),
				sort: `${query.sortDir === 'asc' ? '+' : '-'}${query.sort}`,
				expand: 'createdBy',
				fields: LIST_FIELDS
			}),
			'Could not load replays'
		).andThen((page) =>
			ResultAsync.combine(
				page.items.map((record) =>
					this.serialize(record, parseSnapshot(record.statsSnapshot), false)
				)
			).map((items) => ({
				page: query.page,
				perPage: query.perPage,
				totalItems: page.totalItems,
				totalPages: page.totalItems > 0 ? page.totalPages : query.page > 1 ? query.page : 0,
				items
			}))
		);
	}

	/** Member-replay filter ASTs only understand `ranked` and `map`; null when there is no AST. */
	private filterFromAst(node: unknown): string | null {
		if (!node || typeof node !== 'object') {
			return null;
		}

		const compile = (value: unknown): string => {
			const n = value as { field?: string; op?: string; value?: unknown; children?: unknown[] };
			if (n.field === 'ranked' && n.op === 'eq') {
				return n.value ? 'isRanked = true' : 'isRanked = false';
			}

			if (n.field === 'map') {
				const maps = (Array.isArray(n.value) ? n.value : [n.value]).map(String);
				return maps.length
					? `(${maps.map((map) => this.pb.filter('mapName = {:map}', { map })).join(' || ')})`
					: '';
			}

			if ((n.op === 'and' || n.op === 'or') && Array.isArray(n.children)) {
				const parts = n.children.map(compile).filter(Boolean);
				return parts.length > 1
					? `(${parts.join(n.op === 'or' ? ' || ' : ' && ')})`
					: (parts[0] ?? '');
			}

			return '';
		};
		return compile(node);
	}

	/**
	 * One replay with full detail. A snapshot from before ladder data was captured
	 * is rebuilt on the fly (and cached); the stored one is fixed on the next write.
	 */
	get(id: string, viewer: MemberReplayViewer): Task<MemberReplayView> {
		return pbMaybe(
			this.replays.getOne<ReplayRecord>(id, { expand: 'createdBy' }),
			'Replay not found'
		)
			.andThen((record) => {
				const visible =
					!!record &&
					(record.visibility === 'member' || (record.visibility === 'deleted' && viewer?.isStaff));
				return record && visible && record.file ? ok(record) : err(replayNotFound());
			})
			.andThen((record) => {
				const roster = parseJsonList<ReplayRosterPlayer>(record.players);
				const stored = parseSnapshot(record.statsSnapshot);
				const snapshot: Task<StatsSnapshot | null> = snapshotNeedsRepair(stored, roster)
					? cached(`member-replay:snapshot:${record.id}`, 300, () =>
							this.snapshotOf(roster, record.isRanked, Number(record.durationInSeconds) || 0)
						)
					: okAsync(stored);
				return snapshot.andThen((snapshot) => this.serialize(record, snapshot, true));
			});
	}

	/** Maps used by public member replays. */
	maps(): Task<{ map: string; name: string }[]> {
		return fromPb(
			this.replays.getFullList<{ mapName: string }>({
				filter: "visibility = 'member' && mapName != ''",
				fields: 'mapName'
			}),
			'Could not load maps'
		).map((rows) =>
			[...new Set(rows.map((row) => row.mapName.trim()).filter(Boolean))]
				.sort()
				.slice(0, 100)
				.map((map) => ({ map, name: map }))
		);
	}

	/** Ratings the upload form shows before the replay is saved. */
	previewStats(roster: ReplayRosterPlayer[], isRanked: boolean, durationInSeconds: number) {
		return ResultAsync.combine([
			this.snapshotOf(roster, isRanked, durationInSeconds),
			this.profileIdsOf(roster)
		]).map(([snapshot, profileIds]) => ({
			matchtype_id: snapshot.matchtype_id,
			players: resultPlayers(snapshot),
			livePlayers: livePlayersFromSnapshot(snapshot, toCommunityPlayers(roster, profileIds))
		}));
	}

	/** Maps and player names across the user's own uploads (private included), for their filters. */
	ownFilterOptions(userId: string): Task<{ maps: string[]; players: { name: string }[] }> {
		return fromPb(
			this.replays.getFullList<{ mapName: string; players: unknown }>({
				filter: this.pb.filter('createdBy = {:userId}', { userId }),
				fields: 'mapName,players',
				batch: 1000
			}),
			'Could not load replays'
		).map((rows) => {
			const maps = new Set(rows.map((row) => row.mapName).filter(Boolean));
			const names = new Set(
				rows
					.flatMap((row) =>
						parseJsonList<ReplayRosterPlayer>(row.players).map((player) => player.name ?? '')
					)
					.filter(Boolean)
			);
			return { maps: [...maps].sort(), players: [...names].map((name) => ({ name })) };
		});
	}

	/** Shared by upload and publish: a public member replay with a frozen rating snapshot. */
	private createReplay(
		userId: string,
		file: File,
		fields: Record<string, unknown>
	): Task<MemberReplayView> {
		return fromPb(
			this.replays.create<{ id: string }>({
				...fields,
				createdBy: userId,
				visibility: 'member',
				likeCount: 0,
				downloadCount: 0,
				commentCount: 0,
				file
			}),
			'Could not save replay'
		)
			.andThen((record) => this.services.rewards.markDirty([{ id: userId }]).map(() => record))
			.andThen((record) => this.get(record.id, { id: userId, isStaff: false }));
	}

	/** A member uploads a .rec file with the metadata their analyzer parsed from it. */
	upload(userId: string, file: File, input: MemberUpload): Task<MemberReplayView> {
		const filename = input.filename || file.name || 'replay.rec';
		const roster = input.players as ReplayRosterPlayer[];
		const mapFilename = input.mapFilename || input.mapName || 'Unknown';
		return checkFile(file)
			.andThen(() =>
				ensure(
					filename.toLowerCase().endsWith('.rec'),
					badRequest('Only .rec replay files are supported.')
				)
			)
			.asyncAndThen(() => this.snapshotOf(roster, input.isRanked, input.durationInSeconds))
			.andThen((statsSnapshot) =>
				this.createReplay(
					userId,
					new File([file], replayFileName(filename), { type: 'application/octet-stream' }),
					{
						title: input.title || '-',
						description: input.description,
						filename,
						mapName: displayMapName(input.mapName, mapFilename),
						mapFilename,
						durationInSeconds: input.durationInSeconds,
						isRanked: input.isRanked,
						isVpGame: input.isVpGame,
						isRandomStart: input.isRandomStart,
						isHighResources: input.isHighResources,
						vpCount: input.vpCount,
						...(input.gameDate ? { gameDate: input.gameDate } : {}),
						players: roster,
						messages: input.messages,
						statsSnapshot
					}
				)
			);
	}

	/** The uploader's own public (or, for a repeat delete, deleted) replay. */
	private ownReplay(id: string, userId: string): Task<ReplayRecord> {
		return pbMaybe(this.replays.getOne<ReplayRecord>(id)).andThen((record) => {
			if (!record || (record.visibility !== 'member' && record.visibility !== 'deleted')) {
				return err(replayNotFound());
			}

			if (record.createdBy !== userId) {
				return err(forbidden('You can only edit your own uploads.'));
			}

			return ok(record);
		});
	}

	/** The fields an owner edit changes (a new roster re-freezes the ratings). */
	private editPatch(record: ReplayRecord, input: MemberUpdate): Task<Record<string, unknown>> {
		const patch: Record<string, unknown> = {};
		if (input.title !== undefined) {
			patch.title = input.title;
		}

		if (input.description !== undefined) {
			patch.description = input.description;
		}

		if (input.players === undefined) {
			return okAsync(patch);
		}

		const roster = input.players as ReplayRosterPlayer[];
		return this.snapshotOf(roster, record.isRanked, Number(record.durationInSeconds) || 0).map(
			(statsSnapshot) => ({ ...patch, players: roster, statsSnapshot })
		);
	}

	/**
	 * Owner edits title, description or roster (a new roster re-freezes the ratings).
	 * `visibility: 'deleted'` is the older apps' way to delete.
	 */
	update(
		id: string,
		userId: string,
		input: MemberUpdate
	): Task<MemberReplayView | { id: string; visibility: 'deleted' }> {
		if (input.visibility === 'deleted') {
			return this.remove(id, userId);
		}

		return this.ownReplay(id, userId)
			.andThen((record) => (record.visibility === 'member' ? ok(record) : err(replayNotFound())))
			.andThen((record) => this.editPatch(record, input))
			.andThen((patch) =>
				Object.keys(patch).length > 0
					? fromPb(this.replays.update(id, patch), 'Could not update replay')
					: okAsync(undefined)
			)
			.andThen(() => this.get(id, { id: userId, isStaff: false }));
	}

	/** Soft delete: the replay stays for staff, hidden for everyone else. */
	remove(id: string, userId: string): Task<{ id: string; visibility: 'deleted' }> {
		return this.ownReplay(id, userId)
			.andThen((record) =>
				record.visibility === 'deleted'
					? okAsync(undefined)
					: fromPb(this.replays.update(id, { visibility: 'deleted' }), 'Could not delete replay')
			)
			.map(() => ({ id, visibility: 'deleted' as const }));
	}

	/** The replay file of a match, checked like an upload. */
	private matchReplayFile(lobby: PublishableLobby): Task<Blob> {
		return fromAsync(
			this.fileFetch(this.pb.files.getURL(lobby, lobby.replay)),
			'Could not load the replay file',
			502
		)
			.andThen((response) =>
				response.ok
					? fromAsync(response.blob(), 'Could not load the replay file', 502)
					: errAsync(badRequest('Replay file is required.'))
			)
			.andThen((bytes) => checkFile(bytes).map(() => bytes));
	}

	/** Creates the member replay for a match and links the two. */
	private publishMatch(
		lobby: PublishableLobby,
		userId: string,
		input: PublishFromMatch
	): Task<MemberReplayView> {
		const filename = replayFileName(
			lobby.replay.toLowerCase().endsWith('.rec') ? lobby.replay : `${lobby.replay}.rec`
		);
		const result =
			lobby.result && typeof lobby.result === 'object'
				? (lobby.result as Parameters<typeof snapshotFromResult>[0])
				: null;
		const durationInSeconds = publishDuration(
			input.durationInSeconds,
			Number(lobby.durationSeconds) || 0,
			result
		);
		const roster = (input.players as ReplayRosterPlayer[] | undefined)?.length
			? (input.players as ReplayRosterPlayer[])
			: rosterFromMatch(lobby.players, result);
		const fromResult =
			!input.players?.length && snapshotFromResult(result, lobby.isRanked, durationInSeconds);
		const mapFilename = lobby.map?.trim() || 'Unknown';
		const mapName = displayMapName(lobby.map?.trim() ?? '', mapFilename);

		return ResultAsync.combine([
			this.matchReplayFile(lobby),
			fromResult ? okAsync(fromResult) : this.snapshotOf(roster, lobby.isRanked, durationInSeconds)
		])
			.andThen(([bytes, snapshot]) =>
				this.createReplay(
					userId,
					new File([bytes], filename, { type: 'application/octet-stream' }),
					{
						title: input.title || lobby.title?.trim() || mapName || '-',
						description: input.description,
						filename,
						mapName,
						mapFilename,
						durationInSeconds,
						isRanked: lobby.isRanked,
						isVpGame: false,
						isRandomStart: false,
						isHighResources: false,
						vpCount: 0,
						...(lobby.createdAt ? { gameDate: lobby.createdAt } : {}),
						players: roster,
						messages: [],
						statsSnapshot: snapshot
					}
				)
			)
			.andThen((replay) =>
				fromPb(
					this.pb.collection('lobbies').update(lobby.id, { memberReplay: replay.id }),
					'Could not link the replay to the match'
				)
					// A published match leaves the community feed (isCommunity).
					.andThen(() => this.services.lobbies.process(lobby.id))
					.map(() => replay)
			);
	}

	/** The owner of a match publishes its replay as a member replay (once per match). */
	publishFromMatch(
		lobbyId: string,
		userId: string,
		input: PublishFromMatch
	): Task<MemberReplayView> {
		return pbMaybe(
			this.pb.collection('lobbies').getOne<PublishableLobby>(lobbyId),
			'Match not found'
		).andThen((lobby) => {
			if (!lobby) {
				return errAsync(notFound('Match not found'));
			}

			if (lobby.user !== userId) {
				return errAsync(forbidden('You can only publish your own matches.'));
			}

			if (lobby.memberReplay) {
				return this.get(lobby.memberReplay, { id: userId, isStaff: false }).mapErr(() =>
					conflict('This match is already published.')
				);
			}

			if (!lobby.replay) {
				return errAsync(badRequest('This match has no replay file.'));
			}

			return this.publishMatch(lobby, userId, input);
		});
	}
}
