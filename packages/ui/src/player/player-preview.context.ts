import { Context } from 'runed';
import type { PlayerPreviewData } from './types';

export type PlayerPreviewContext = {
	load: (id: string) => Promise<PlayerPreviewData | null>;
	resolveAvatarUrl: (url: string) => string;
	flagImageUrl: (country: string | null | undefined) => string | null;
	levelLabel?: string;
	loadingLabel?: string;
	errorLabel?: string;
};

const context = new Context<() => PlayerPreviewContext>('<player-preview />');

export const createPlayerPreview = (get: () => PlayerPreviewContext) => context.set(get);

/** Returns the context getter, or null when the host has not registered a preview loader. */
export const usePlayerPreview = (): (() => PlayerPreviewContext) | null =>
	context.exists() ? context.get() : null;
