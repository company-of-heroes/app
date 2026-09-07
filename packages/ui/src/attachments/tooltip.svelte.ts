import type { Attachment } from 'svelte/attachments';
import tippy, { type Props } from 'tippy.js';

export const tooltip = (content: string, options?: Partial<Props>): Attachment => {
	return (element) => {
		const instance = tippy(element, {
			content: `<span class="bg-secondary-950 inline-flex items-center rounded px-2 py-1.5 text-sm leading-none">${content}</span>`,
			delay: [200, null],
			allowHTML: true,
			...options
		});
		return instance.destroy;
	};
};
