/// <reference path="../pb_data/types.d.ts" />

// Labels staff removed from a player by hand. The website's label-auto and rewards-evaluate
// jobs skip these pairs, so a removed Veteran or reward label does not come back. Staff
// assigning the label again deletes the row. Schema only.

migrate(
	(app) => {
		try {
			app.findCollectionByNameOrId('player_label_revocations');
			return;
		} catch {
			// create below
		}

		const labels = app.findCollectionByNameOrId('user_labels');
		const staff = '@request.auth.role = "admin" || @request.auth.role = "moderator"';
		const revocations = new Collection({
			createRule: staff,
			deleteRule: staff,
			listRule: staff,
			viewRule: staff,
			updateRule: null,
			name: 'player_label_revocations',
			type: 'base',
			indexes: [
				'CREATE UNIQUE INDEX `idx_player_label_revocations_steam_label` ON `player_label_revocations` (`steamId`, `label`)'
			],
			fields: [
				{
					autogeneratePattern: '[a-z0-9]{15}',
					hidden: false,
					id: 'text_player_label_revocations_id',
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
					autogeneratePattern: '',
					hidden: false,
					id: 'text_player_label_revocations_steam',
					max: 17,
					min: 17,
					name: 'steamId',
					pattern: '^[0-9]{17}$',
					presentable: false,
					primaryKey: false,
					required: true,
					system: false,
					type: 'text'
				},
				{
					cascadeDelete: true,
					collectionId: labels.id,
					hidden: false,
					id: 'relation_player_label_revocations_label',
					maxSelect: 1,
					minSelect: 1,
					name: 'label',
					presentable: false,
					required: true,
					system: false,
					type: 'relation'
				},
				{
					hidden: false,
					id: 'autodate_player_label_revocations_created',
					name: 'created',
					onCreate: true,
					onUpdate: false,
					presentable: false,
					system: false,
					type: 'autodate'
				},
				{
					hidden: false,
					id: 'autodate_player_label_revocations_updated',
					name: 'updated',
					onCreate: true,
					onUpdate: true,
					presentable: false,
					system: false,
					type: 'autodate'
				}
			]
		});

		return app.save(revocations);
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('player_label_revocations'));
		} catch {
			// already gone
		}
	}
);
