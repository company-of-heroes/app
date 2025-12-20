import { parseReplay } from '@fknoobs/replay-parser';
import dayjs from '$lib/dayjs';

const DATE_FORMATS = [
	'DD/MM/YYYY HH:mm',
	'D/M/YYYY HH:mm',
	'DD/M/YYYY HH:mm',
	'D/MM/YYYY HH:mm',
	'DD-MM-YYYY HH:mm',
	'D-M-YYYY HH:mm',
	'DD-M-YYYY HH:mm',
	'D-MM-YYYY HH:mm',
	'MM/DD/YYYY HH:mm',
	'M/D/YYYY HH:mm',
	'MM-DD-YYYY HH:mm',
	'M-D-YYYY HH:mm',
	'YYYY-MM-DD HH:mm',
	'YYYY/MM/DD HH:mm',
	'DD/MM/YYYY h:mm A',
	'D/M/YYYY h:mm A',
	'DD/MM/YYYY h:mm a',
	'D/M/YYYY h:mm a',
	'MM/DD/YYYY h:mm A',
	'M/D/YYYY h:mm A',
	'MM/DD/YYYY h:mm a',
	'M/D/YYYY h:mm a',
	'DD-MM-YYYY h:mm A',
	'D-M-YYYY h:mm A',
	'DD-MM-YYYY h:mm a',
	'D-M-YYYY h:mm a',
	'DD-MMM-YY h:mm A',
	'DD-MMM-YY h:mm a'
];

onmessage = async ({ data }: MessageEvent) => {
	const { id, type } = data;

	try {
		if (type === 'process') {
			const { content, fileName, userId, pbUrl, authToken } = data;

			const replay = parseReplay(content);

			const formData = new FormData();
			formData.append('durationInSeconds', String(replay.duration));
			formData.append('file', new File([content], fileName));
			formData.append('filename', fileName);
			formData.append('gameDate', dayjs(replay.gameDate, DATE_FORMATS).toISOString());
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
			const replay = parseReplay(content);

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
					id,
					success: true,
					replay: simplifiedReplay,
					content
				},
				{ transfer: [content.buffer] }
			);
		}
	} catch (error) {
		console.error(`Worker failed:`, error);
		postMessage({
			id,
			success: false,
			error: String(error)
		});
	}
};

export {};
