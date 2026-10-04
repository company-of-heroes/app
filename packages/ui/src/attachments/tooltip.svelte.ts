import type { Attachment } from 'svelte/attachments';
import tippy, { type Props } from 'tippy.js';
import { tooltipPanel } from '../variants';

export const tooltip = (content: string, options?: Partial<Props>): Attachment => {
	return (element) => {
		const instance = tippy(element, {
			content: `<span class="${tooltipPanel}">${content}</span>`,
			delay: [200, null],
			duration: [150, 100],
			offset: [0, 8],
			maxWidth: 'none',
			allowHTML: true,
			...options
		});
		return instance.destroy;
	};
};
