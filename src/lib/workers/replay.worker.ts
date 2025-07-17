import type { DirEntry } from '@tauri-apps/plugin-fs';
import { ReplayParser } from '$core/replay-analyzer';

onmessage = async ({ data }: MessageEvent<{ files: DirEntry[]; pathToReplays: string }>) => {
	const files = data.files.filter(
		(file) => file.isFile && file.isSymlink === false && file.name.endsWith('.rec')
	);

	const replaysParsed = await Promise.all(
		files.map(async (file) => ReplayParser.parse(data.pathToReplays + '/' + file.name, true))
	);

	console.log(replaysParsed);
};

export {};
