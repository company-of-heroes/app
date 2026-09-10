import { parseReplay } from '@fknoobs/replay-parser';
import { fetch } from '$core/http/fetch';
import { flattenReplay } from '$lib/utils/flatten-replay';

onmessage = async ({ data }: MessageEvent) => {
	const { id, type } = data;

	try {
		if (type === 'process') {
			const { content, fileName, userId, pbUrl, authToken } = data;

			const replay = flattenReplay(parseReplay(content));

			const formData = new FormData();
			formData.append('durationInSeconds', String(replay.duration));
			formData.append('file', new File([content], fileName));
			formData.append('filename', fileName);
			formData.append('gameDate', replay.gameDate);
			formData.append('isHighResources', String(replay.highResources));
			formData.append('isRandomStart', String(replay.randomStart));
			formData.append('mapFilename', replay.mapFileName);
			formData.append('mapName', replay.mapName);
			formData.append(
				'isRanked',
				String(replay.matchType?.toLowerCase().includes('automatch') ?? false)
			);
			formData.append('isVpGame', String(replay.vpGame));
			formData.append('vpCount', String(replay.vpCount));
			formData.append('players', JSON.stringify(replay.players));
			formData.append('messages', JSON.stringify(replay.messages));
			formData.append('title', !replay.replayName ? '-' : replay.replayName);
			formData.append('createdBy', userId);
			formData.append('visibility', 'private');

			const response = await fetch(`${pbUrl}/api/collections/replays/records`, {
				method: 'POST',
				headers: {
					Authorization: authToken
				},
				body: formData
			});

			if (!response.ok) {
				throw new Error(`Failed to upload replay: ${response.statusText}`);
			}

			postMessage({ id, success: true });
		} else {
			const { content, fileName } = data;
			const replay = flattenReplay(parseReplay(content));

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

			postMessage({
				id,
				success: true,
				replay: simplifiedReplay,
				fileName
			});
		}
	} catch (error) {
		postMessage({
			id,
			success: false,
			error: error instanceof Error ? error.message : String(error)
		});
	}
};

export {};
