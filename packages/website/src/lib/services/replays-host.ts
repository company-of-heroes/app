import { env } from '$env/dynamic/private';
import {
	matchFileUrl,
	type MemberReplayUploadInput,
	type MatchHistoryScopeOptions,
	type ReplaysApi,
	type ReplaysQuery
} from '@company-of-heroes/api';
import { errAsync, ok, ResultAsync } from 'neverthrow';
import { appError, fromUnknown, type AppError } from '$lib/errors/app-error';
import { allowReplayFileRequest } from '$lib/utils/rate-limit';

export type ReplayFileDownload = {
	body: ReadableStream<Uint8Array>;
	contentType: string;
	filename: string;
};

/** Website-only wrapper: api.replays + rate-limited getFile with REPLAY_PROXY_SECRET. */
export class WebsiteReplaysService {
	constructor(
		private replays: ReplaysApi,
		private fetchFn: typeof fetch,
		private baseUrl: string
	) {}

	getHistory(query: ReplaysQuery, perPage?: number, options?: MatchHistoryScopeOptions) {
		return this.replays.getHistory(query, perPage, options);
	}

	getMemberHistory(query: ReplaysQuery, perPage?: number) {
		return this.replays.getMemberHistory(query, perPage);
	}

	getMaps(options?: MatchHistoryScopeOptions) {
		return this.replays.getMaps(options);
	}

	getMemberMaps() {
		return this.replays.getMemberMaps();
	}

	get(id: string) {
		return this.replays.get(id);
	}

	getMember(id: string) {
		return this.replays.getMember(id);
	}

	getAny(id: string) {
		return this.replays.getAny(id);
	}

	getMine(page = 1, perPage = 30) {
		return this.replays.getMine(page, perPage);
	}

	download(id: string, visitorId: string, clientIp: string) {
		const secret = env.REPLAY_PROXY_SECRET;
		return this.replays.download(id, {
			visitorId,
			clientIp,
			headers: secret ? { 'X-Replay-Proxy': secret } : undefined
		});
	}

	downloadMember(id: string, visitorId: string, clientIp: string) {
		const secret = env.REPLAY_PROXY_SECRET;
		return this.replays.downloadMember(id, {
			visitorId,
			clientIp,
			headers: secret ? { 'X-Replay-Proxy': secret } : undefined
		});
	}

	uploadMember(input: MemberReplayUploadInput) {
		return this.replays.uploadMember(input);
	}

	updateMember(
		id: string,
		input: Parameters<ReplaysApi['updateMember']>[1]
	) {
		return this.replays.updateMember(id, input);
	}

	deleteMember(id: string) {
		return this.replays.deleteMember(id);
	}

	previewMemberStats(input: {
		players: unknown;
		isRanked: boolean;
		durationInSeconds?: number;
	}) {
		return this.replays.previewMemberStats(input);
	}

	publish(id: string, description?: string) {
		return this.replays.publish(id, description);
	}

	publishFromMatch(
		lobbyId: string,
		input?: {
			title?: string;
			description?: string;
			durationInSeconds?: number;
			players?: unknown;
		}
	) {
		return this.replays.publishFromMatch(lobbyId, input);
	}

	getFile(id: string, clientIp: string): ResultAsync<ReplayFileDownload, AppError> {
		const limited = allowReplayFileRequest(clientIp);
		if (!limited.ok) {
			return errAsync(
				appError(429, 'Too many download requests. Try again in a moment.', {
					retryAfter: limited.retryAfter
				})
			);
		}

		return this.getAny(id).andThen((match) => {
			const fileUrl = matchFileUrl(this.baseUrl, match);
			if (!fileUrl) {
				return errAsync(appError(404, 'Replay not found'));
			}

			const fileHeaders: Record<string, string> = {
				'X-Client-IP': clientIp
			};
			const secret = env.REPLAY_PROXY_SECRET;
			if (secret) {
				fileHeaders['X-Replay-Proxy'] = secret;
			}

			return ResultAsync.fromPromise(this.fetchFn(fileUrl, { headers: fileHeaders }), (error) =>
				fromUnknown(error, 'Failed to download replay')
			).andThen((file) => {
				if (file.status === 429) {
					return errAsync(
						appError(429, 'Too many download requests. Try again in a moment.', {
							retryAfter: Number(file.headers.get('Retry-After')) || 30
						})
					);
				}

				if (!file.ok || !file.body) {
					return errAsync(
						appError(
							file.status === 404 ? 404 : 502,
							file.status === 404 ? 'Replay not found' : 'Failed to download replay'
						)
					);
				}

				return ok({
					body: file.body,
					contentType: file.headers.get('Content-Type') ?? 'application/octet-stream',
					filename: match.filename || match.replay || `${match.id}.rec`
				});
			});
		});
	}
}
