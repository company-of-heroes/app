import { app } from '$core/app';
import { readDir, readFile } from '@tauri-apps/plugin-fs';
import { Plugin } from '../plugin.svelte';
import { dirname, join } from '@tauri-apps/api/path';
import { parseReplayFile, ReplayParser } from '$core/replay-analyzer';
import dayjs from '$lib/dayjs';
import { fetch } from '@tauri-apps/plugin-http';

export class ReplayAnalyzer extends Plugin {
	name = 'replay-analyzer';

	enable() {
		app.on('ready', async () => {
			const replays = await app.database.replays().getAllForUser(app.game.steamId!);
			console.log(replays);
		});
		// const pathToReplays = await join(
		// 	await dirname(app.settings.companyOfHeroesConfigPath),
		// 	'playback'
		// );
		// const entries = (await readDir(pathToReplays)).slice(0, 1000);
		// const replayFile = await readFile(await join(pathToReplays, replayFiles[846].name));
		// console.time('replay-parse');
		// const replay = await parseReplayFile(await join(pathToReplays, replayFiles[846].name));
		// console.timeEnd('replay-parse');
		// console.time('replay-parse2');
		// const replay2 = new ReplayParser(replayFile).parse();
		// console.timeEnd('replay-parse2');
		// console.log(replay, replay2);
		// app.on('ready', async () => {
		// 	console.log('Uploading replay:', replay.replayName);
		// 	const response = await app.pocketbase.collection('replays').create(
		// 		{
		// 			submittedBy: app.game.steamId,
		// 			name: replay.replayName,
		// 			mapFileName: replay.mapFileName,
		// 			mapName: replay.mapName,
		// 			gameDate: dayjs(replay.gameDate, 'DD/MM/YYYY HH:mm').toDate(),
		// 			isRanked: replay.matchType.toLowerCase().includes('automatch'),
		// 			isVpGame: replay.vpGame,
		// 			isRandomStart: replay.randomStart,
		// 			isHighResources: replay.highResources,
		// 			vpCount: replay.vpCount,
		// 			durationInSeconds: replay.duration,
		// 			players: replay.players,
		// 			messages: replay.messages,
		// 			actions: replay.actions,
		// 			file: new File([replayFile], replayFiles[846].name, { type: 'application/octet-stream' })
		// 		},
		// 		{ fetch: fetch }
		// 	);
		// 	console.log(response);
		// });
	}

	defaultSettings() {
		return {
			enabled: true
		};
	}
}

export const replayAnalyzer = new ReplayAnalyzer();
