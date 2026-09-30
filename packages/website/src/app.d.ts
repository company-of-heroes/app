/// <reference types="@sveltejs/kit" />

import type { AuthUserPublic } from '$lib/auth/user';
import type { AppLocale, TranslateFn } from '@company-of-heroes/i18n';
import type PocketBase from 'pocketbase';
import type { Api } from '@company-of-heroes/api';
import type { Services } from '$lib/server/services';

declare module '*.md?raw' {
	const content: string;
	export default content;
}

declare global {
	namespace App {
		interface Error {
			message: string;
		}
		interface Locals {
			pocketbase: PocketBase;
			/** The shared API client acting as the signed-in user (account, profile customization). */
			api: Api;
			services: Services;
			user: AuthUserPublic | null;
			locale: AppLocale;
			t: TranslateFn;
		}
		interface LayoutData {
			user: AuthUserPublic | null;
			locale: AppLocale;
		}
		interface PageData {
			locale: AppLocale;
		}
		/** Cloudflare bindings (wrangler.toml); absent in plain `vite dev`. */
		interface Platform {
			env?: {
				DOWNLOAD_BURST?: RateLimiter;
				DOWNLOAD_MINUTE?: RateLimiter;
				FILE_BURST?: RateLimiter;
				FILE_MINUTE?: RateLimiter;
				OVERLAYS?: import('$lib/server/services/overlays').OverlayBucket;
			};
		}
	}

	/** Cloudflare rate-limit binding. */
	interface RateLimiter {
		limit(options: { key: string }): Promise<{ success: boolean }>;
	}
}

export {};
