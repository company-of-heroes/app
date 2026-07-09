import PocketBase from 'pocketbase';

const pbUrl = process.env.PB_URL ?? 'http://localhost:8090';
const pbEmail = process.env.PB_ADMIN_EMAIL;
const pbPassword = process.env.PB_ADMIN_PASSWORD;
const batchSize = Number(process.env.BATCH_SIZE ?? 25);

if (!pbEmail || !pbPassword) {
	console.error('Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD');
	process.exit(1);
}

const pb = new PocketBase(pbUrl);

function summarizePlayers(players) {
	if (!Array.isArray(players)) {
		return { summaries: [], csv: '' };
	}

	const summaries = [];
	const ids = [];

	for (const player of players) {
		const profileId = player?.profile?.profile_id;
		if (profileId == null) {
			continue;
		}

		ids.push(profileId);
		summaries.push({
			profile_id: profileId,
			alias: player?.profile?.alias ?? '',
			playerId: player?.playerId ?? null,
			steamId: player?.steamId ?? null,
			race: player?.race ?? null
		});
	}

	return {
		summaries,
		csv: ids.length > 0 ? `,${ids.join(',')},` : ''
	};
}

await pb.collection('_superusers').authWithPassword(pbEmail, pbPassword);

let page = 1;
let updated = 0;

while (true) {
	const batch = await pb.collection('lobbies').getList(page, batchSize, {
		filter: 'lobbyPlayers = "" || lobbyPlayers = null || playerProfileIdsCsv = ""',
		fields: 'id,players,replay,lobbyPlayers,playerProfileIdsCsv'
	});

	if (batch.items.length === 0) {
		break;
	}

	for (const record of batch.items) {
		const { summaries, csv } = summarizePlayers(record.players);

		await pb.collection('lobbies').update(record.id, {
			lobbyPlayers: summaries,
			playerProfileIdsCsv: csv,
			hasReplay: Boolean(record.replay)
		});

		updated += 1;
		if (updated % 50 === 0) {
			console.log(`Updated ${updated} lobbies...`);
		}
	}

	if (batch.items.length < batchSize) {
		break;
	}

	page += 1;
}

console.log(`Done. Updated ${updated} lobbies.`);
