export type DatePreset = 'date' | 'dateTime';

const presets: Record<DatePreset, Intl.DateTimeFormatOptions> = {
	date: { day: 'numeric', month: 'short', year: 'numeric' },
	dateTime: { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
};

/** Formats an ISO string, Date or unix-seconds number. Returns '—' for missing or invalid input. */
export function formatDate(
	value: string | number | Date | null | undefined,
	locale: string,
	preset: DatePreset = 'date'
): string {
	if (value == null || value === '') {
		return '—';
	}

	const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
	if (!Number.isFinite(date.getTime())) {
		return '—';
	}

	return new Intl.DateTimeFormat(locale, presets[preset]).format(date);
}

export function formatRelative(unixSeconds: number, locale: string): string {
	const delta = Date.now() / 1000 - unixSeconds;
	const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
	const abs = Math.abs(delta);
	if (abs < 60) {
		return rtf.format(Math.round(delta) * -1, 'second');
	}

	if (abs < 3600) {
		return rtf.format(Math.round(delta / 60) * -1, 'minute');
	}

	if (abs < 86400) {
		return rtf.format(Math.round(delta / 3600) * -1, 'hour');
	}

	if (abs < 604800) {
		return rtf.format(Math.round(delta / 86400) * -1, 'day');
	}

	if (abs < 31536000) {
		return rtf.format(Math.round(delta / 604800) * -1, 'week');
	}

	return rtf.format(Math.round(delta / 31536000) * -1, 'year');
}
