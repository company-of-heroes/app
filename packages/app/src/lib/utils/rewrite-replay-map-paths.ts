import { prepareForLocalCoh } from '@fknoobs/replay-parser';

/**
 * Prepares a .rec for local CoH / Replay Manager playback: strips FKSTMETA and
 * rewrites foreign workshop map-archive paths to this machine's Documents tree.
 */
export function rewriteReplayMapPathsForLocalPlayback(
	bytes: Uint8Array,
	localDocuments: string
): Uint8Array {
	return prepareForLocalCoh(bytes, { localDocuments }).bytes;
}
