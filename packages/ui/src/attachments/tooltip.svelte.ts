import type { Attachment } from 'svelte/attachments';
import tippy, { type Props } from 'tippy.js';
import { tooltipPanel } from '../variants';

/** Tooltip content is HTML: escape user data (names, paths, titles) before passing it in. */
export const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

export const tooltip = (
	content: string | null | undefined,
	options?: Partial<Props>
): Attachment => {
	return (element) => {
		if (!content) {
			return;
		}

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
