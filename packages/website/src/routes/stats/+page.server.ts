import { z } from 'zod';
import {
	STATISTICS_MODES,
	STATISTICS_PERIODS,
	type StatisticsMode,
	type StatisticsRange
} from '@company-of-heroes/ui/statistics/types';
import { unwrapAsync } from '$lib/errors/unwrap';
import type { PageServerLoad } from './$types';

export const prerender = false;

const day = z.iso.date();

function pick<T extends string>(values: readonly T[], value: string | null, fallback: T): T {
	return values.find((entry) => entry === value) ?? fallback;
}

/** `from`/`to` (YYYY-MM-DD) when both are valid and in order, ending today at the latest; else `period`. */
function rangeFrom(params: URLSearchParams): StatisticsRange {
	const from = day.safeParse(params.get('from'));
	const to = day.safeParse(params.get('to'));
	if (from.success && to.success) {
		const today = new Date().toISOString().slice(0, 10);
		const end = to.data > today ? today : to.data;
		if (from.data <= end) {
			return { from: from.data, to: end };
		}
	}

	return { period: pick(STATISTICS_PERIODS, params.get('period'), 'all') };
}

export const load: PageServerLoad = ({ locals, url }) => {
	const mode: StatisticsMode = pick(STATISTICS_MODES, url.searchParams.get('mode'), '1v1');
	const range = rangeFrom(url.searchParams);
	return {
		mode,
		range,
		statistics: unwrapAsync(locals.services.statistics.get(range))
	};
};
