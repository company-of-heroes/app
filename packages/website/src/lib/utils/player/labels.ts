export const DEFAULT_LABEL_HEX = '#FEC766';

const TOKEN_HEX: Record<string, string> = {
	primary: '#FEC766',
	default: '#A3A3A8',
	warning: '#E5B84C',
	success: '#3DBA63',
	info: '#3B8FD9',
	destructive: '#E5484D'
};

export type PlayerLabel = {
	id: string;
	name: string;
	color: string;
	sort?: number;
};

export function labelHex(color?: string | null): string {
	if (!color) return DEFAULT_LABEL_HEX;
	if (TOKEN_HEX[color]) return TOKEN_HEX[color];
	if (/^#[0-9A-Fa-f]{8}$/.test(color)) return color.slice(0, 7);
	if (/^#[0-9A-Fa-f]{6}$/.test(color)) return color;
	if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
		return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
	}
	return DEFAULT_LABEL_HEX;
}

export function sortPlayerLabels(labels: PlayerLabel[]): PlayerLabel[] {
	return [...labels].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
}
