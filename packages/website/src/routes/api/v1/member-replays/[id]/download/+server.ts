import { countDownload } from '$lib/server/downloads';
import { handle } from '$lib/server/http';

/** Counts a (possibly anonymous) download of the member replay, once per visitor. */
export const POST = handle((event) => countDownload(event, 'replay', event.params.id ?? ''));
