import type { GuideLanguage } from './types';

/** Native names of the guide languages, for the language select and badges. */
export const GUIDE_LANGUAGE_NAMES: Record<GuideLanguage, string> = {
	en: 'English',
	es: 'Español',
	ko: '한국어'
};

/** i18n keys of the guide statuses. */
export const GUIDE_STATUS_LABELS = {
	draft: 'Draft',
	published: 'Published'
} as const;
