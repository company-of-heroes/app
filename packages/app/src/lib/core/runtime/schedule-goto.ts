import { goto } from '$app/navigation';

type GotoOptions = NonNullable<Parameters<typeof goto>[1]>;

/**
 * `goto` during the first `load` / component init runs before SvelteKit attaches
 * the click router. A second navigation at that moment can leave every later
 * link as a full document load. Defer until the router is up.
 */
export function scheduleGoto(url: string, opts?: GotoOptions): void {
	setTimeout(() => {
		void goto(url, opts);
	}, 0);
}
