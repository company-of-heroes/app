import { okAsync, ResultAsync } from 'neverthrow';
import type { RecordModel } from 'pocketbase';
import { cached, uncache } from '../cache';
import { badRequest } from '../errors';
import { titleIsHidden } from '../domain/lobby-derive';
import { all, ensure, fromPb, sequence, type Task } from '../result';
import { Service } from './service';

type Rules = { sessions: Set<number>; keywords: string[] };
type HiddenLobby = {
	id: string;
	sessionId: number;
	isHidden: boolean;
	result: { description?: string } | null;
};

/** Keywords are stored lowercased with single spaces. */
export function normalizeKeyword(value: unknown): string {
	return String(value ?? '')
		.trim()
		.replace(/\s+/g, ' ')
		.toLowerCase();
}

/**
 * Staff can hide a match by Relic session id, or every match whose title contains
 * a keyword. The outcome is stored per lobby (`lobbies.isHidden`); API rules hide
 * those rows from everyone but staff.
 */
export class HiddenMatchesService extends Service {
	private loadRules(): Task<{ sessions: number[]; keywords: string[] }> {
		return ResultAsync.combine([
			fromPb(
				this.pb
					.collection('hidden_matches')
					.getFullList<{ sessionId: number }>({ fields: 'sessionId' })
					.then((rows) => rows.map((row) => Number(row.sessionId))),
				'Could not load hidden matches'
			),
			fromPb(
				this.pb
					.collection('hidden_match_keywords')
					.getFullList<{ word: string }>({ fields: 'word' })
					.then((rows) => rows.map((row) => row.word)),
				'Could not load hidden match keywords'
			)
		]).map(([sessions, keywords]) => ({ sessions, keywords }));
	}

	rules(): Task<Rules> {
		return cached('hidden:rules', 60, () => this.loadRules()).map((loaded) => ({
			sessions: new Set(loaded.sessions),
			keywords: loaded.keywords
		}));
	}

	/** Lobbies currently hidden (`lobbies.isHidden`, kept in sync with the rules); few, indexed. */
	lobbyIds(): Task<Set<string>> {
		return cached('hidden:lobby-ids', 60, () =>
			fromPb(
				this.pb
					.collection('lobbies')
					.getFullList<{ id: string }>({ filter: 'isHidden = true', fields: 'id' })
					.then((rows) => rows.map((row) => row.id)),
				'Could not load hidden lobbies'
			)
		).map((ids) => new Set(ids));
	}

	isSessionHidden(sessionId: number): Task<boolean> {
		return this.rules().map((rules) => rules.sessions.has(sessionId));
	}

	/** Re-applies the (fresh) rules to the lobbies matching `filter`. */
	private refresh(filter: string): Task<void> {
		return all([uncache('hidden:rules'), uncache('hidden:lobby-ids')])
			.andThen(() => this.loadRules())
			.andThen((loaded) =>
				fromPb(
					this.pb
						.collection('lobbies')
						.getFullList<HiddenLobby>({ filter, fields: 'id,sessionId,isHidden,result' }),
					'Could not load lobbies'
				).andThen((lobbies) => {
					const sessions = new Set(loaded.sessions);
					const changed = lobbies
						.map((lobby) => ({
							id: lobby.id,
							isHidden: lobby.isHidden,
							hidden:
								sessions.has(Number(lobby.sessionId)) ||
								titleIsHidden(lobby.result?.description, loaded.keywords)
						}))
						.filter((lobby) => lobby.hidden !== lobby.isHidden);
					return sequence(changed, (lobby) =>
						fromPb(
							this.pb.collection('lobbies').update(lobby.id, { isHidden: lobby.hidden }),
							'Could not update lobby'
						)
					);
				})
			)
			.map(() => undefined);
	}

	private sessionFilter(sessionId: number) {
		return this.pb.filter('sessionId = {:sessionId}', { sessionId });
	}

	/** Lobbies a keyword may now hide (the exact whole-word check follows in `refresh`). */
	private keywordFilter(word: string) {
		return this.pb.filter('isHidden = false && result.description ~ {:word}', { word });
	}

	hide(sessionId: number, staffId: string): Task<RecordModel> {
		const hiddenMatches = this.pb.collection('hidden_matches');
		const filter = this.sessionFilter(sessionId);
		return ensure(Number.isInteger(sessionId) && sessionId > 0, badRequest('sessionId is required'))
			.asyncAndThen(() =>
				fromPb(
					hiddenMatches.getList(1, 1, { filter, skipTotal: true }),
					'Could not load hidden matches'
				)
			)
			.andThen((existing) =>
				existing.items[0]
					? okAsync(existing.items[0])
					: fromPb(hiddenMatches.create({ sessionId, hiddenBy: staffId }), 'Could not hide match')
			)
			.andThen((record) => this.refresh(filter).map(() => record));
	}

	unhide(sessionId: number): Task<void> {
		const hiddenMatches = this.pb.collection('hidden_matches');
		const filter = this.sessionFilter(sessionId);
		return fromPb(
			hiddenMatches.getFullList<{ id: string }>({ filter, fields: 'id' }),
			'Could not load hidden matches'
		)
			.andThen((rows) =>
				all(rows.map((row) => fromPb(hiddenMatches.delete(row.id), 'Could not unhide match')))
			)
			.andThen(() => this.refresh(filter));
	}

	/** Hides a tournament game until `unhideTournament` (the tournament ends or is cancelled). */
	hideForTournament(sessionId: number, tournamentId: string, userId: string): Task<void> {
		const hiddenMatches = this.pb.collection('hidden_matches');
		const filter = this.sessionFilter(sessionId);
		return fromPb(
			hiddenMatches.getList<{ id: string }>(1, 1, { filter, skipTotal: true }),
			'Could not load hidden matches'
		)
			.andThen((existing) =>
				existing.items[0]
					? okAsync(undefined)
					: fromPb(
							hiddenMatches.create({ sessionId, tournament: tournamentId, hiddenBy: userId }),
							'Could not hide the tournament game'
						).map(() => undefined)
			)
			.andThen(() => this.refresh(filter));
	}

	/** Shows every game a tournament hid again; staff-hidden matches stay hidden. */
	unhideTournament(tournamentId: string): Task<void> {
		const hiddenMatches = this.pb.collection('hidden_matches');
		return fromPb(
			hiddenMatches.getFullList<{ id: string; sessionId: number }>({
				filter: this.pb.filter('tournament = {:tournamentId}', { tournamentId }),
				fields: 'id,sessionId'
			}),
			'Could not load hidden matches'
		).andThen((rows) =>
			rows.length === 0
				? okAsync(undefined)
				: sequence(rows, (row) =>
						fromPb(hiddenMatches.delete(row.id), 'Could not unhide the tournament game')
					).andThen(() =>
						this.refresh(rows.map((row) => this.sessionFilter(Number(row.sessionId))).join(' || '))
					)
		);
	}

	addKeyword(rawWord: unknown, staffId: string): Task<RecordModel> {
		const word = normalizeKeyword(rawWord);
		return ensure(word, badRequest('Word is required.'))
			.asyncAndThen(() =>
				fromPb(
					this.pb.collection('hidden_match_keywords').create({ word, createdBy: staffId }),
					'Could not add keyword'
				)
			)
			.andThen((record) => this.refresh(this.keywordFilter(word)).map(() => record));
	}

	updateKeyword(id: string, rawWord: unknown): Task<RecordModel> {
		const word = normalizeKeyword(rawWord);
		return ensure(word, badRequest('Word is required.'))
			.asyncAndThen(() =>
				fromPb(
					this.pb.collection('hidden_match_keywords').update(id, { word }),
					'Keyword not found'
				)
			)
			.andThen((record) =>
				// The old word may no longer hide some lobbies; the new one may hide others.
				this.refresh(`isHidden = true || (${this.keywordFilter(word)})`).map(() => record)
			);
	}

	removeKeyword(id: string): Task<void> {
		return fromPb(
			this.pb.collection('hidden_match_keywords').delete(id),
			'Keyword not found'
		).andThen(() => this.refresh('isHidden = true'));
	}
}
