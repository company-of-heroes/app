import type { Attachment } from 'svelte/attachments';
import type { HostContext } from '../host/host.context';

/**
 * Links in rendered guide text: site paths (`/wiki/...`, `/guides/...`) navigate inside the host,
 * outside links open through the host (the desktop app hands them to the system browser instead
 * of opening its own dev or webview origin). Modified clicks keep the browser's default.
 */
export function guideLinkClicks(host: HostContext): Attachment<HTMLElement> {
	return (element) => {
		const click = (event: MouseEvent) => {
			if (event.defaultPrevented || event.button !== 0) {
				return;
			}

			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
				return;
			}

			const anchor = event.target instanceof Element ? event.target.closest('a') : null;
			const href = anchor?.getAttribute('href');
			if (!anchor || !href || href.startsWith('#')) {
				return;
			}

			if (/^https?:\/\//i.test(href)) {
				if (host.openExternal) {
					event.preventDefault();
					host.openExternal(href);
				}

				return;
			}

			if (href.startsWith('/')) {
				event.preventDefault();
				void host.url.goto(href);
			}
		};

		element.addEventListener('click', click);
		return () => element.removeEventListener('click', click);
	};
}
