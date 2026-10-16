import { page } from '$app/state';
import { useHost } from '@company-of-heroes/ui/host';
import { isSupporter } from '@company-of-heroes/ui/format/labels';
import { meSteamIds } from '$lib/auth/user';

/**
 * Whether the signed-in user holds the supporter label. Uses the cached label lookup the whole
 * site already shares, so it costs no extra request per page view. Call during component init.
 */
export function useIsSupporter() {
	const host = useHost();
	const steamId = $derived(meSteamIds(page.data.user)[0] ?? null);
	return {
		get current() {
			return steamId ? isSupporter(host.api.labels.forSteamId(steamId)) : false;
		}
	};
}
