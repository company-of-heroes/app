import { page } from '$app/state';
import { localizeHref, parseLocaleFromPath, type AppLocale } from '@company-of-heroes/i18n';

export {
	createI18n,
	createTranslate,
	DEFAULT_LOCALE,
	detectLocale,
	englishHref,
	isLocale,
	localeLabels,
	localeSwitchHref,
	locales,
	localizeHref,
	parseLocaleFromPath,
	provideI18n,
	safeInternalPath,
	translate,
	unlocalizedPath,
	useI18n,
	type AppI18n,
	type AppLocale,
	type TranslateFn
} from '@company-of-heroes/i18n';

export function currentLocale(): AppLocale {
	return parseLocaleFromPath(page.url.pathname).locale;
}

export function href(path: string, locale: AppLocale = currentLocale()): string {
	return localizeHref(path, locale);
}
