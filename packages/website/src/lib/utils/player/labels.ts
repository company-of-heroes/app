import { labelHex, sortPlayerLabels } from '@company-of-heroes/ui/format/labels';
export { labelHex, sortPlayerLabels } from '@company-of-heroes/ui/format/labels';

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
