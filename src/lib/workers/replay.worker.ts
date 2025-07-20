import { parseReplay } from '$core/replay-analyzer';
import { readFile } from '@tauri-apps/plugin-fs';
// import type { DirEntry, FileInfo } from '@tauri-apps/plugin-fs';

onmessage = async ({ data }: MessageEvent<{ name: string; fileName: string; path: string }>) => {
	console.log(__TAURI__);
	//readFile(`${data.path}/${data.fileName}`);
	// try {
	// 	postMessage({ replay: parseReplay(data.replayData, data.fileName) });
	// } catch (error) {
	// 	console.error('Failed to parse replay in worker:', error);
	// }
};

export {};
