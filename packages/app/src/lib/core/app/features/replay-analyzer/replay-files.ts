import { invoke } from '@tauri-apps/api/core';

export type ReplayFileEntry = {
	name: string;
	path: string;
	modifiedMs: number;
	size: number;
};

/** Lists the `.rec` files in a folder (name, path, mtime, size) with one IPC call. */
export function listReplayFiles(dir: string): Promise<ReplayFileEntry[]> {
	return invoke<ReplayFileEntry[]>('list_replay_files', { dir });
}
