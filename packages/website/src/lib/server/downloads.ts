import type { RequestEvent } from '@sveltejs/kit';
import { isStaffUser } from '$lib/auth/user';
import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { rateLimited } from './errors';
import type { Task } from './result';
import type { TargetKind } from './services/social';

/**
 * Replay downloads: per-IP rate limits (Cloudflare rate-limit bindings, see
 * wrangler.toml; without them, in local dev, nothing is limited) and counting
 * each visitor once.
 */
const LIMITS = {
	/** Counting a download: 10 per 10 s, 30 per minute. */
	count: [
		{ binding: 'DOWNLOAD_BURST', seconds: 10 },
		{ binding: 'DOWNLOAD_MINUTE', seconds: 60 }
	],
	/** Fetching the file: 8 per 10 s, 40 per minute. */
	file: [
		{ binding: 'FILE_BURST', seconds: 10 },
		{ binding: 'FILE_MINUTE', seconds: 60 }
	]
} as const;

const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clientIp(event: RequestEvent): string {
	try {
		return event.getClientAddress();
	} catch {
		return '';
	}
}

export function limitDownloads(event: RequestEvent, kind: keyof typeof LIMITS): Task<void> {
	const key = `${kind}:${clientIp(event) || 'unknown'}`;
	return ResultAsync.fromSafePromise(
		(async () => {
			for (const { binding, seconds } of LIMITS[kind]) {
				const limiter = event.platform?.env?.[binding];
				if (limiter && !(await limiter.limit({ key })).success) {
					return seconds;
				}
			}
			return null;
		})()
	).andThen((retryAfter) =>
		retryAfter === null
			? okAsync(undefined)
			: errAsync(rateLimited('Too many download requests. Try again in a moment.', retryAfter))
	);
}

async function sha256(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Hashed IP and visitor id; the same hashes the stored fingerprints use. */
export function downloadFingerprints(ip: string, visitorId: string): Promise<string[]> {
	const visitor = visitorId.trim();
	return Promise.all([
		...(ip ? [sha256(`ip:${ip}`)] : []),
		...(VISITOR_ID.test(visitor) ? [sha256(`vid:${visitor.toLowerCase()}`)] : [])
	]);
}

/**
 * Counts a (possibly anonymous) download of a match or member replay, once per
 * visitor. `visitorId` defaults to the `X-Download-Visitor` header.
 */
export function countDownload(
	event: RequestEvent,
	kind: TargetKind,
	id: string,
	visitorId?: string
): Task<{ downloadCount: number; counted: boolean }> {
	const isStaff = !!event.locals.user && isStaffUser(event.locals.user);
	return limitDownloads(event, 'count')
		.andThen(() =>
			ResultAsync.fromSafePromise(
				downloadFingerprints(
					clientIp(event),
					visitorId ?? event.request.headers.get('x-download-visitor') ?? ''
				)
			)
		)
		.andThen((fingerprints) =>
			event.locals.services.social.recordAnonymousDownload({ kind, id }, fingerprints, isStaff)
		);
}
