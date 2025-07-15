import ReplayParser from './ReplayParser.js';
import { ActionDefinitions } from './ActionDefinitions.js';
import { Replay } from './Replay.js';

// Main entry point - example usage
export default class CoHReplayParser {
	constructor() {
		this.parser = new ReplayParser();
	}

	parseReplay(replayFilePath, actionDefinitionsPath = null) {
		try {
			let actionDefinitions = null;

			if (actionDefinitionsPath) {
				actionDefinitions = new ActionDefinitions(actionDefinitionsPath);
			}

			const replay = this.parser.parse(replayFilePath, actionDefinitions);

			return {
				success: true,
				replay: replay,
				summary: {
					fileName: replay.fileName,
					gameDate: replay.gameDate,
					mapName: replay.mapName,
					playerCount: replay.playerCount,
					messageCount: replay.messageCount,
					actionCount: replay.actionCount,
					duration: this.calculateDuration(replay),
					players: replay.players.map((p) => ({
						name: p.name,
						faction: p.faction,
						id: p.id,
						doctrine: p.doctrine
					}))
				}
			};
		} catch (error) {
			return {
				success: false,
				error: error.message,
				stack: error.stack
			};
		}
	}

	parseHeaderOnly(replayFilePath, actionDefinitionsPath = null) {
		try {
			let actionDefinitions = null;

			if (actionDefinitionsPath) {
				actionDefinitions = new ActionDefinitions(actionDefinitionsPath);
			}

			const replay = new Replay(replayFilePath, actionDefinitions);
			const parsedReplay = this.parser.parseReplay(replay, true);

			return {
				success: true,
				header: {
					fileName: parsedReplay.fileName,
					replayVersion: parsedReplay.replayVersion,
					gameType: parsedReplay.gameType,
					gameDate: parsedReplay.gameDate,
					modName: parsedReplay.modName,
					mapFileName: parsedReplay.mapFileName,
					mapName: parsedReplay.mapName,
					mapDescription: parsedReplay.mapDescription,
					mapWidth: parsedReplay.mapWidth,
					mapHeight: parsedReplay.mapHeight,
					replayName: parsedReplay.replayName,
					MD5Hash: parsedReplay.MD5Hash,
					matchType: parsedReplay.matchType,
					highResources: parsedReplay.highResources,
					randomStart: parsedReplay.randomStart,
					vpCount: parsedReplay.vpCount,
					VPgame: parsedReplay.VPgame,
					playerCount: parsedReplay.playerCount,
					players: parsedReplay.players
				}
			};
		} catch (error) {
			return {
				success: false,
				error: error.message,
				stack: error.stack
			};
		}
	}

	calculateDuration(replay) {
		if (replay.actionCount === 0) return '00:00:00';

		const lastAction = replay.actions[replay.actions.length - 1];
		return lastAction.timeStamp;
	}
	async exportToJSON(replay, filePath) {
		const fs = await import('fs');
		const data = replay.toDataSet();
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	}

	async exportMessagesToText(replay, filePath) {
		const fs = await import('fs');
		let content = 'Company of Heroes Replay Chat Log\n';
		content += '==================================\n\n';

		for (const message of replay.messages) {
			content += `[${message.timeStamp}] ${message.playerName}: ${message.text}\n`;
		}

		fs.writeFileSync(filePath, content);
	}
}

const parser = new CoHReplayParser();
console.log(
	parser
		.parseReplay(
			'C:/Users/Richa/app/coh.replayparser/temp.rec',
			'C:/Users/Richa/app/coh.replayparser/cohra.dat'
		)
		.replay?.actions?.map((a) => a.actionDefinitions)[0].actionDefinitions
);
