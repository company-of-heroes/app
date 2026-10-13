import { api, unwrapApi } from '$core/api';
import type { HeadToHead } from '@company-of-heroes/api/head-to-head';

export type { HeadToHead };

/** Head-to-head record of `me` against each opponent profile id; rejects on API errors. */
export async function getHeadToHead(
	profileIds: number[],
	me: number | null
): Promise<Record<number, HeadToHead>> {
	return unwrapApi(api.headToHead.get({ profileIds, me }));
}
