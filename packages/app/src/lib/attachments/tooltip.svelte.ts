import type { Attachment } from 'svelte/attachments';
import tippy, { type Props } from 'tippy.js';

export const tooltip = (content: string, options?: Partial<Props>): Attachment => {
	return (element) => {
		const tooltip = tippy(element, {
			content: `<span class="bg-secondary-950 rounded px-2 py-1 text-sm">${content}</span>`,
			delay: [200, null],
			allowHTML: true,
			...options
		});
		return tooltip.destroy;
	};
};
