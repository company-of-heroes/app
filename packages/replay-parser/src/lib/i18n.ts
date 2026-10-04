import { load } from '@tauri-apps/plugin-store';
import {
	createI18n,
	detectLocale,
	instanceTranslate,
	interpolate,
	isLocale,
	type AppI18n,
	type AppLocale,
	type TranslateFn
} from '@company-of-heroes/i18n';

export { provideI18n, useI18n } from '@company-of-heroes/i18n';

const LOCALE_KEY = 'locale';

let instance: AppI18n | null = null;

const settings = () => load('settings.json', { autoSave: true, defaults: {} });

/** The language picked in the header, or `null` to follow the OS language. */
async function savedLocale(): Promise<AppLocale | null> {
	try {
		const locale = await (await settings()).get<string>(LOCALE_KEY);
		return isLocale(locale) ? locale : null;
	} catch {
		return null;
	}
}

export async function initI18n(): Promise<AppI18n> {
	if (instance) {
		return instance;
	}

	const locale = (await savedLocale()) ?? detectLocale();
	instance = await createI18n(locale);
	document.documentElement.lang = locale;
	return instance;
}

export async function setLocale(locale: AppLocale): Promise<void> {
	if (!instance || instance.getLocale() === locale) {
		return;
	}

	instance.setLocale(locale);
	document.documentElement.lang = locale;
	await (await settings()).set(LOCALE_KEY, locale);
}

export function getI18n(): AppI18n {
	if (!instance) {
		throw new Error('i18n is not initialized');
	}

	return instance;
}

/** For non-component modules (toasts from the library); components use `useI18n()`. */
export const t: TranslateFn = (key, params) => {
	if (!instance) {
		return interpolate(key, params);
	}

	return instanceTranslate(instance)(key, params);
};
