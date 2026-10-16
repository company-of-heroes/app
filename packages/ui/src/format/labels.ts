import type { RewardCondition, RewardMetric } from '../reward/metrics';
import type { PlayerLabel } from './types';

export const DEFAULT_LABEL_HEX = '#FEC766';

/** Label granted automatically after 12 hours of streaming Company of Heroes. */
export const STREAMER_LABEL_NAME = 'Streamer';

/** `key` of the system label held by active supporters. */
export const SUPPORTER_LABEL_KEY = 'supporter';

/** Metrics that make a label live: the label is removed again once the condition stops holding. */
export const SUPPORTER_METRICS: readonly RewardMetric[] = ['supporter_active', 'supporter_months'];

const TOKEN_HEX: Record<string, string> = {
	primary: '#FEC766',
	default: '#A3A3A8',
	warning: '#E5B84C',
	success: '#3DBA63',
	info: '#3B8FD9',
	destructive: '#E5484D'
};

export function labelHex(color?: string | null): string {
	if (!color) {
		return DEFAULT_LABEL_HEX;
	}

	if (TOKEN_HEX[color]) {
		return TOKEN_HEX[color];
	}

	if (/^#[0-9A-Fa-f]{8}$/.test(color)) {
		return color.slice(0, 7);
	}

	if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
		return color;
	}

	if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
		return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
	}

	return DEFAULT_LABEL_HEX;
}

export function sortPlayerLabels(labels: PlayerLabel[]): PlayerLabel[] {
	return [...labels].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
}

export function isStreamer(labels: PlayerLabel[] | null | undefined): boolean {
	return (labels ?? []).some((label) => label.name === STREAMER_LABEL_NAME);
}

export function isSupporter(labels: PlayerLabel[] | null | undefined): boolean {
	return (labels ?? []).some((label) => label.key === SUPPORTER_LABEL_KEY);
}

/** A label tied to an active subscription: it is taken back when the subscription ends. */
export function isLiveLabel(conditions: readonly Pick<RewardCondition, 'metric'>[]): boolean {
	return conditions.some((condition) => condition.metric === 'supporter_active');
}
