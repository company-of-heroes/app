export const STEAM_ID_REGEX = /^7656119\d{10}$/;

export function isSteamId(value: string): boolean {
	return STEAM_ID_REGEX.test(value.trim());
}

export function parseCardSteamId(pathname: string): string | null {
	const match = pathname.match(/^\/card\/(7656119\d{10})\/?$/);
	return match?.[1] ?? null;
}

export function isCardRoute(pathname: string): boolean {
	return pathname === '/card' || pathname.startsWith('/card/');
}

export const routerState = $state({
	pathname: typeof window !== 'undefined' ? window.location.pathname : '/'
});

export function navigate(to: string) {
	if (typeof window === 'undefined') {
		return;
	}
	window.history.pushState({}, '', to);
	routerState.pathname = window.location.pathname;
	const hash = window.location.hash;
	if (hash) {
		requestAnimationFrame(() => {
			document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
		});
	}
}

export function initRouter() {
	if (typeof window === 'undefined') {
		return;
	}
	routerState.pathname = window.location.pathname;
	window.addEventListener('popstate', () => {
		routerState.pathname = window.location.pathname;
	});
}
