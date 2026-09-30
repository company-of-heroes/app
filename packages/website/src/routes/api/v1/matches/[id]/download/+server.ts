import { countDownload } from '$lib/server/downloads';
import { handle } from '$lib/server/http';

/** Counts a (possibly anonymous) download of the match replay, once per visitor. */
export const POST = handle((event) => countDownload(event, 'lobby', event.params.id ?? ''));
