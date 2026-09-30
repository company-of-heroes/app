import { env } from '$env/dynamic/private';
import { err, ok, okAsync } from 'neverthrow';
import { API_URL } from '$lib/site/urls';
import { upstream } from '../errors';
import { fromAsync, type Task } from '../result';

export const RELIC_BASE = 'https://coh1-lobby.reliclink.com';

export type RelicResult<T> =
	| { url: string; ok: true; body: T }
	| { url: string; ok: false; error: string };

/**
 * Relic's certificate is rejected by Workers, so requests go through PocketBase's
 * `/api/_relic` forwarder (pb_hooks/relic-proxy.pb.js). One call fetches up to 100 urls.
 */
export class RelicClient {
	constructor(private readonly fetch: typeof globalThis.fetch) {}

	getMany<T>(urls: string[]): Task<RelicResult<T>[]> {
		if (!urls.length) {
			return okAsync([]);
		}

		return fromAsync(
			this.fetch(`${API_URL}/api/_relic`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: `Bearer ${env.SERVICE_TOKEN ?? ''}`
				},
				body: JSON.stringify({ urls })
			}),
			'Relic proxy unreachable',
			502
		).andThen((response) =>
			response.ok
				? fromAsync(
						response.json() as Promise<{ results: RelicResult<T>[] }>,
						'Relic proxy sent invalid JSON',
						502
					).map(({ results }) => results)
				: err(upstream(`Relic proxy failed (${response.status})`))
		);
	}

	get<T>(path: string): Task<T> {
		return this.getMany<T>([`${RELIC_BASE}${path}`]).andThen(([result]) =>
			result?.ok ? ok(result.body) : err(upstream(result?.error ?? 'Relic request failed'))
		);
	}
}
