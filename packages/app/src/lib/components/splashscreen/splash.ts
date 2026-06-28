/** Minimum splash intro duration (ms). */
export const SPLASH_INTRO_MS = 1600;

export const removeBootSplash = (): void => {
	document.getElementById('boot-splash')?.remove();
};
