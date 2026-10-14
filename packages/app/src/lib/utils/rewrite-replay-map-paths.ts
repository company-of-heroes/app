import { prepareForLocalCoh } from '@fknoobs/replay-parser';

/**
 * Turns a Linux path into the path the game sees under Wine/Proton. The prefix's
 * `drive_c` is `C:`, everything else is reachable through `Z:`. Windows paths
 * are returned as-is.
 */
export function toWinePath(path: string): string {
	if (!path.startsWith('/')) {
		return path;
	}

	const driveC = path.match(/\/pfx\/drive_c(\/.*)?$/);
	if (driveC) {
		return `C:${(driveC[1] ?? '/').replace(/\//g, '\\')}`;
	}

	return `Z:${path.replace(/\//g, '\\')}`;
}

/**
 * Prepares a .rec for local CoH / Replay Manager playback: strips FKSTMETA and
 * rewrites foreign workshop map-archive paths to this machine's Documents tree.
 */
export function rewriteReplayMapPathsForLocalPlayback(
	bytes: Uint8Array,
	localDocuments: string
): Uint8Array {
	return prepareForLocalCoh(bytes, { localDocuments: toWinePath(localDocuments) }).bytes;
}
