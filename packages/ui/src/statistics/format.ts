/** `part` of `total` as a percentage with one decimal ("48.2%"), or "-" without data. */
export function percent(part: number, total: number): string {
	if (total <= 0) {
		return '-';
	}

	return `${((part / total) * 100).toFixed(1)}%`;
}

/** Text color of a win rate: green above, red below an even split. */
export function winRateClass(wins: number, total: number): string {
	if (total <= 0) {
		return 'text-secondary-400';
	}

	const rate = wins / total;
	if (rate >= 0.505) {
		return 'text-green-400';
	}

	if (rate <= 0.495) {
		return 'text-red-400';
	}

	return 'text-secondary-200';
}

export function formatCount(value: number, locale?: string): string {
	return value.toLocaleString(locale);
}

export function minutes(seconds: number | null): number | null {
	return seconds === null ? null : Math.round(seconds / 60);
}
