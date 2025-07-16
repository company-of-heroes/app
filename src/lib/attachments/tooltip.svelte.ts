import type { Attachment } from 'svelte/attachments';
import tippy from 'tippy.js';

export const tooltip = (content: string): Attachment => {
	return (element) => {
		const tooltip = tippy(element, {
			content: `<span class="bg-black">${content}</span>`,
			delay: [1000, null],
			allowHTML: true,
			placement: 'top-start'
		});
		return tooltip.destroy;
	};
};
