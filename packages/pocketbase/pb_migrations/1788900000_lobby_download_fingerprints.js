/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		try {
			app.findCollectionByNameOrId('lobby_download_fingerprints');
			return;
		} catch {
			// create below
		}

		const collection = new Collection({
			createRule: null,
			deleteRule: null,
			listRule: null,
			viewRule: null,
			updateRule: null,
			name: 'lobby_download_fingerprints',
			type: 'base',
			id: 'pbc_9182736450',
			indexes: [
				'CREATE UNIQUE INDEX `idx_lobby_download_fingerprints_lobby_fp` ON `lobby_download_fingerprints` (`lobby`, `fingerprint`)',
				'CREATE INDEX `idx_lobby_download_fingerprints_lobby` ON `lobby_download_fingerprints` (`lobby`)'
			],
			fields: [
				{
					autogeneratePattern: '[a-z0-9]{15}',
					hidden: false,
					id: 'text3208210256',
					max: 15,
					min: 15,
					name: 'id',
					pattern: '^[a-z0-9]+$',
					presentable: false,
					primaryKey: true,
					required: true,
					system: true,
					type: 'text'
				},
				{
					cascadeDelete: true,
					collectionId: 'pbc_1574334436',
					hidden: false,
					id: 'relation_lobby_download_fp_lobby',
					maxSelect: 1,
					minSelect: 1,
					name: 'lobby',
					presentable: false,
					required: true,
					system: false,
					type: 'relation'
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text_lobby_download_fp',
					max: 64,
					min: 64,
					name: 'fingerprint',
					pattern: '^[a-f0-9]+$',
					presentable: false,
					primaryKey: false,
					required: true,
					system: false,
					type: 'text'
				},
				{
					hidden: false,
					id: 'autodate_lobby_download_fp_created',
					name: 'created',
					onCreate: true,
					onUpdate: false,
					presentable: false,
					system: false,
					type: 'autodate'
				},
				{
					hidden: false,
					id: 'autodate_lobby_download_fp_updated',
					name: 'updated',
					onCreate: true,
					onUpdate: true,
					presentable: false,
					system: false,
					type: 'autodate'
				}
			]
		});
		app.save(collection);
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('lobby_download_fingerprints'));
		} catch {
			// already gone
		}
	}
);
