import { pocketbase } from '$core/pocketbase';

declare global {
	interface Window {
		__cohCreateHandoffForBrowser?: () => Promise<string>;
	}
}

export function registerBrowserHandoffGlobal(): void {
	window.__cohCreateHandoffForBrowser = async () => {
		if (!pocketbase.authStore.isValid) {
			throw new Error('Not signed in to the desktop app.');
		}

		// Dynamic: $core/api pulls in the account module, which registers this global.
		const { siteApi } = await import('$core/api');
		const payload = await siteApi<{ code?: string }>('/auth/handoff', { method: 'POST' });

		if (!payload.code?.startsWith('signed-v1.')) {
			throw new Error('Could not create a browser login link.');
		}

		return payload.code;
	};
}
