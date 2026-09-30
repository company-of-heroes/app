/// <reference path="../pb_data/types.d.ts" />

const LOBBY_INDEXES = [
	'CREATE INDEX `idx_lobbies_like_count` ON `lobbies` (`likeCount`)',
	'CREATE INDEX `idx_lobbies_download_count` ON `lobbies` (`downloadCount`)',
	'CREATE INDEX `idx_lobbies_comment_count` ON `lobbies` (`commentCount`)',
	'CREATE INDEX `idx_lobbies_duration_seconds` ON `lobbies` (`durationSeconds`)',
	'CREATE INDEX `idx_lobbies_avg_elo` ON `lobbies` (`avgElo`)'
];

const INDEX_ELO_INDEX = 'CREATE INDEX `idx_lpi_elo` ON `lobby_player_index` (`elo`)';
const INDEX_RACE_ELO =
	'CREATE INDEX `idx_lpi_lobby_race_elo` ON `lobby_player_index` (`lobby`, `race_id`, `elo`)';

migrate(
	(app) => {
		const lobbies = app.findCollectionByNameOrId('lobbies');

		if (!lobbies.fields.getByName('durationSeconds')) {
			lobbies.fields.add(
				new Field({
					hidden: false,
					id: 'number_lobby_duration_seconds',
					max: null,
					min: 0,
					name: 'durationSeconds',
					onlyInt: true,
					presentable: false,
					required: false,
					system: false,
					type: 'number'
				})
			);
		}

		if (!lobbies.fields.getByName('avgElo')) {
			lobbies.fields.add(
				new Field({
					hidden: false,
					id: 'number_lobby_avg_elo',
					max: null,
					min: 0,
					name: 'avgElo',
					onlyInt: false,
					presentable: false,
					required: false,
					system: false,
					type: 'number'
				})
			);
		}

		const lobbyIndexes = [];
		for (const index of lobbies.indexes) {
			lobbyIndexes.push(String(index));
		}
		for (const index of LOBBY_INDEXES) {
			const name = index.split('`')[1];
			if (!lobbyIndexes.some((existing) => existing.includes(name))) {
				lobbyIndexes.push(index);
			}
		}
		lobbies.indexes = lobbyIndexes;
		app.save(lobbies);

		let indexCollection;
		try {
			indexCollection = app.findCollectionByNameOrId('lobby_player_index');
		} catch {
			indexCollection = null;
		}

		if (indexCollection && !indexCollection.fields.getByName('elo')) {
			indexCollection.fields.add(
				new Field({
					hidden: false,
					id: 'number_lobby_player_index_elo',
					max: null,
					min: 0,
					name: 'elo',
					onlyInt: true,
					presentable: false,
					required: false,
					system: false,
					type: 'number'
				})
			);

			const indexes = [];
			for (const index of indexCollection.indexes) {
				indexes.push(String(index));
			}
			for (const index of [INDEX_ELO_INDEX, INDEX_RACE_ELO]) {
				const name = index.split('`')[1];
				if (!indexes.some((existing) => existing.includes(name))) {
					indexes.push(index);
				}
			}
			indexCollection.indexes = indexes;
			app.save(indexCollection);
		}
	},
	(app) => {
		const lobbies = app.findCollectionByNameOrId('lobbies');
		if (lobbies.fields.getByName('durationSeconds')) {
			lobbies.fields.removeByName('durationSeconds');
		}

		if (lobbies.fields.getByName('avgElo')) {
			lobbies.fields.removeByName('avgElo');
		}

		const lobbyIndexes = [];
		for (const index of lobbies.indexes) {
			const text = String(index);
			if (!LOBBY_INDEXES.some((candidate) => text.includes(candidate.split('`')[1]))) {
				lobbyIndexes.push(text);
			}
		}
		lobbies.indexes = lobbyIndexes;
		app.save(lobbies);

		let indexCollection;
		try {
			indexCollection = app.findCollectionByNameOrId('lobby_player_index');
		} catch {
			return;
		}

		if (indexCollection.fields.getByName('elo')) {
			indexCollection.fields.removeByName('elo');
		}

		const indexes = [];
		for (const index of indexCollection.indexes) {
			const text = String(index);
			if (!text.includes('idx_lpi_elo') && !text.includes('idx_lpi_lobby_race_elo')) {
				indexes.push(text);
			}
		}
		indexCollection.indexes = indexes;
		app.save(indexCollection);
	}
);
