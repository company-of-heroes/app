import { parseReplay } from '@fknoobs/replay-parser';

onmessage = async ({
	data
}: MessageEvent<{ id: number; content: Uint8Array; fileName: string }>) => {
	try {
		// Parse the replay using the shared parser
		// We pass the fileName as it might be used for metadata
		const replay = parseReplay(data.content);

		// Send back the parsed data
		// Note: Methods on the Replay class will be lost during serialization,
		// but we only need the data properties for the database.

		// Extract only needed fields to avoid sending huge command lists
		const {
			duration,
			gameDate,
			highResources,
			randomStart,
			mapFileName,
			mapName,
			matchType,
			vpGame,
			vpCount,
			players,
			messages,
			replayName
		} = replay;

		const simplifiedReplay = {
			duration,
			gameDate,
			highResources,
			randomStart,
			mapFileName,
			mapName,
			matchType,
			vpGame,
			vpCount,
			players,
			messages,
			replayName
		};

		postMessage(
			{
				id: data.id,
				success: true,
				replay: simplifiedReplay,
				content: data.content
			},
			{ transfer: [data.content.buffer] }
		);
	} catch (error) {
		console.error(`Worker failed to parse ${data.fileName}:`, error);
		postMessage({
			id: data.id,
			success: false,
			error: String(error)
		});
	}
};

export {};
