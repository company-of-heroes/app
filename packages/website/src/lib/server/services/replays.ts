import { resetReplayMetadata } from '@fknoobs/replay-parser';
import { err, errAsync, ok, okAsync, ResultAsync, type Result } from 'neverthrow';
import { notFound, rateLimited, upstream, type AppError } from '../errors';
import { fromAsync, type Task } from '../result';
import type { MatchDetail, MatchViewer } from './matches';
import type { MemberReplayView } from './member-replays';
import { Service } from './service';

export type ReplayFile = {
	body: ReadableStream<Uint8Array> | Uint8Array;
	contentType: string;
	filename: string;
};

export type AnyReplay = (MatchDetail & { kind: 'match' }) | MemberReplayView;

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
