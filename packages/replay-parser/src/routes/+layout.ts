import { initI18n } from '$lib/i18n';

export const prerender = true;
export const ssr = false;

export const load = async () => ({ i18n: await initI18n() });
