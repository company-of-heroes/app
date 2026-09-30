import { createI18n as createI18nInstance, type I18nInstance } from '@svelte-i18n/core';
import { locales, type AppLocale } from './locales';
import { en, es, ko, wrapTranslate, type AppDictionary, type TranslateFn } from './translate';

export type AppI18n = I18nInstance<AppDictionary, AppLocale, AppLocale>;

export async function createI18n(locale: AppLocale): Promise<AppI18n> {
	return (await createI18nInstance({
		locales: [...locales],
		locale,
		fallbackLocale: 'en',
		dictionaries: {
			en,
			es,
			ko
		}
	})) as AppI18n;
}

export function instanceTranslate(i18n: AppI18n): TranslateFn {
	return wrapTranslate(
		() => i18n.t as TranslateFn,
		() => i18n.getLocale()
	);
}
