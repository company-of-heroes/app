/// <reference types="@sveltejs/kit" />

import type { AuthUserPublic } from '$lib/auth/user';
import type { AppLocale, TranslateFn } from '@company-of-heroes/i18n';
import type PocketBase from 'pocketbase';
import type { Services } from '$lib/services/create-services';

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
	}
}

export {};
