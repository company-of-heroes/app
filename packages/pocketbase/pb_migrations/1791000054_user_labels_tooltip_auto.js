/// <reference path="../pb_data/types.d.ts" />

// Labels get an optional tooltip (empty shows none) and can be granted automatically:
// `autoRank20` labels go to every Steam ID with rank 20 on two 1v1/2v2 ladders. The
// website's `label-auto` job assigns them. Schema only.

migrate(
	(app) => {
		const labels = app.findCollectionByNameOrId('user_labels');
		if (!labels.fields.getByName('tooltip')) {
			labels.fields.add(
				new Field({
					autogeneratePattern: '',
					hidden: false,
					id: 'text_user_labels_tooltip',
					max: 200,
					min: 0,
					name: 'tooltip',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				})
			);
		}

		if (!labels.fields.getByName('autoRank20')) {
			labels.fields.add(
				new Field({
					hidden: false,
					id: 'bool_user_labels_auto_rank20',
					name: 'autoRank20',
					presentable: false,
					required: false,
					system: false,
					type: 'bool'
				})
			);
		}

		app.save(labels);
	},
	(app) => {
		const labels = app.findCollectionByNameOrId('user_labels');
		labels.fields.removeByName('tooltip');
		labels.fields.removeByName('autoRank20');
		app.save(labels);
	}
);
