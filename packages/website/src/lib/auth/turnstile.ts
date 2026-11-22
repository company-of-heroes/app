import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import type { AppLocale } from '@company-of-heroes/i18n';

type TurnstileApi = {
	render(container: HTMLElement, options: Record<string, unknown>): string;
	reset(widgetId: string): void;
	remove(widgetId: string): void;
};

declare global {
	interface Window {
		turnstile?: TurnstileApi;
	}
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
/** Cloudflare's always-pass test key: local development needs no widget of its own. */
const TEST_SITE_KEY = '1x00000000000000000000AA';

let script: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
	script ??= new Promise((resolve, reject) => {
		if (window.turnstile) {
			resolve(window.turnstile);
			return;
		}

		const tag = document.createElement('script');
		tag.src = SCRIPT_URL;
		tag.async = true;
		tag.onload = () => (window.turnstile ? resolve(window.turnstile) : reject());
		tag.onerror = () => {
			script = null;
			reject(new Error('Turnstile failed to load'));
		};
		document.head.append(tag);
	});
	return script;
}

/**
 * A Turnstile challenge inside a form: it adds the `cf-turnstile-response` field the
 * server checks. `reset()` asks for a new token (each one is valid for a single submit).
 */
export function createTurnstile(locale: AppLocale) {
	let widgetId: string | null = null;

	function attach(node: HTMLElement) {
		let removed = false;
		loadTurnstile()
			.then((turnstile) => {
				if (removed) {
					return;
				}

				widgetId = turnstile.render(node, {
					sitekey: env.PUBLIC_TURNSTILE_SITE_KEY || (dev ? TEST_SITE_KEY : ''),
					theme: 'dark',
					language: locale
				});
			})
			.catch((error) => console.error('[turnstile]', error));
		return () => {
			removed = true;
			if (widgetId) {
				window.turnstile?.remove(widgetId);
				widgetId = null;
			}
		};
	}

	function reset() {
		if (widgetId) {
			window.turnstile?.reset(widgetId);
		}
	}

	return { attach, reset };
}
