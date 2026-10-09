import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import type { LiveLobbyPlayer } from '@company-of-heroes/ui/live-lobby/types';
import { notFound } from '../errors';
import { pbMaybe, type Task } from '../result';
import {
	attachPlayerStats,
	rowsNeedingRawPlayers,
	toHistoryRow,
	type HistoryRow,
	type ListPlayer,
	type LobbyListRecord,
	type RawLobby
} from '../domain/history-rows';
import { finishedPlayers, inProgressPlayers, submittedBy } from '../domain/match-detail';
import { titleHasHiddenKeyword } from '../domain/relic-matches';
import { Service } from './service';

type LobbyRecord = LobbyListRecord & {
	user: string;
	replay: string;
	players: unknown;
	memberReplay: string;
	isHidden: boolean;
	updatedAt: string;
	expand?: { user?: { name?: string; email?: string; steamIds?: unknown } };
};

export type MatchViewer = { id: string; isStaff: boolean } | null;

export type MatchDetail = {
	id: string;
	map: string;
	title: string;
	isRanked: boolean;
	createdAt: string;
	durationSeconds: number | null;
	likeCount: number;
	downloadCount: number;
	replay: string;
	hasReplay: boolean;
	needsResult: boolean;
	sessionId: number;
	hidden: boolean;
	hiddenByKeyword: boolean;
	submittedBy: ReturnType<typeof submittedBy>;
	players: ListPlayer[];
	livePlayers: LiveLobbyPlayer[];
	result: LobbyListRecord['result'];
	memberReplayId: string | null;
	/** Only true for the uploader, so the response must not be shared-cached when signed in. */
	canPublish: boolean;
	/** A signed-in participant may attach the missing replay (viewer-specific, like `canPublish`). */
	canAttachReplay: boolean;
	/** Staff only. */
	updatedAt?: string;
	owner?: string | null;
};

export class MatchesService extends Service {
	private find(id: string): Task<LobbyRecord | null> {
		return pbMaybe(
			this.pb.collection('lobbies').getOne<LobbyRecord>(id, { expand: 'user' }),
			'Match not found'
		);
	}
	/**
	 * One community match: finished games with a replay, or games still in progress.
	 * Hidden matches (e.g. tournament games before the tournament ends) are visible to
	 * staff and to the match's own players only.
	 */
	get(id: string, viewer: MatchViewer): Task<MatchDetail> {
		return this.find(id)
			.andThen((record) => {
				const hasReplay = !!record && (record.hasReplay || !!record.replay);
				// Owners always see their own match (the desktop app lists every match you played).
				const isOwner = !!record && !!viewer && viewer.id === record.user;
				const listed = !!record && (hasReplay || record.needsResult || isOwner);
				if (!record || !listed) {
					return errAsync(notFound('Match not found'));
				}

				if (!record.isHidden || viewer?.isStaff || isOwner) {
					return okAsync(record);
				}

				return (
					viewer ? this.services.lobbies.isParticipant(record, viewer.id) : okAsync(false)
				).andThen((participant) =>
					participant ? okAsync(record) : errAsync(notFound('Match not found'))
				);
			})
			.andThen((record) => {
				const row = toHistoryRow(record);
				return this.livePlayersOf(record, row).andThen((livePlayers) =>
					this.detail(record, row, livePlayers, viewer)
				);
			});
	}

	/** In progress: the roster with stored ELO; finished: the result's players. */
	private livePlayersOf(record: LobbyRecord, row: HistoryRow): Task<LiveLobbyPlayer[]> {
		if (record.needsResult) {
			const rosterSteamIds = (Array.isArray(record.players) ? record.players : [])
				.map((player: { steamId?: string }) => player?.steamId)
				.filter((steamId): steamId is string => !!steamId);
			return this.services.playerInfo
				.elo(rosterSteamIds)
				.map((elo) => inProgressPlayers(record.players, record.isRanked, elo));
		}

		const raw: RawLobby = {
			id: record.id,
			players: record.players as RawLobby['players'],
			result: record.result,
			isRanked: record.isRanked
		};
		attachPlayerStats(
			[row],
			rowsNeedingRawPlayers([row]).length ? new Map([[record.id, raw]]) : new Map()
		);
		return okAsync(finishedPlayers(row.players));
	}

	private detail(
		record: LobbyRecord,
		row: HistoryRow,
		livePlayers: LiveLobbyPlayer[],
		viewer: MatchViewer
	): Task<MatchDetail> {
		const players = row.players;
		const steamIds = [...players, ...livePlayers]
			.map((player) => player.steamId)
			.filter((steamId): steamId is string => !!steamId);
		const canAttach: Task<boolean> =
			viewer && !record.hasReplay && !record.replay
				? this.services.lobbies.isParticipant(record, viewer.id)
				: okAsync(false);
		return ResultAsync.combine([
			this.services.playerInfo.likeCounts(steamIds),
			this.services.hiddenMatches.rules(),
			canAttach
		]).map(([likes, rules, canAttachReplay]) => {
			for (const player of [...players, ...livePlayers]) {
				if (player.steamId && likes.has(player.steamId)) {
					player.likeCount = likes.get(player.steamId);
				}
			}

			const hasReplay = record.hasReplay || !!record.replay;
			const uploader = record.expand?.user;
			const uploaderSteamIds = Array.isArray(uploader?.steamIds)
				? uploader.steamIds.map(String)
				: [];
			const detail: MatchDetail = {
				id: record.id,
				map: record.map || '',
				title: record.title || '',
				isRanked: row.isRanked,
				createdAt: record.createdAt,
				durationSeconds: row.durationSeconds,
				likeCount: record.likeCount || 0,
				downloadCount: record.downloadCount || 0,
				replay: record.replay || '',
				hasReplay,
				needsResult: record.needsResult,
				sessionId: record.sessionId || 0,
				hidden: record.isHidden,
				hiddenByKeyword: titleHasHiddenKeyword(
					(record.result as { description?: string } | null)?.description,
					rules.keywords
				),
				submittedBy: submittedBy(record.result?.players, uploaderSteamIds),
				players,
				livePlayers,
				result: record.result,
				memberReplayId: record.memberReplay || null,
				canPublish: !!viewer && viewer.id === record.user && hasReplay && !record.memberReplay,
				canAttachReplay
			};
			if (viewer?.isStaff) {
				detail.updatedAt = record.updatedAt;
				detail.owner = uploader
					? uploader.name?.trim() || uploader.email?.trim() || record.user
					: null;
			}

			return detail;
		});
	}
}
