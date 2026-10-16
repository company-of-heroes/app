/// <reference path="../pb_data/types.d.ts" />

// Labels can carry reward conditions: the website's rewards-evaluate job assigns the label
// to every linked Steam ID that meets all of them. Empty for labels staff hand out. Schema only.

migrate(
	(app) => {
		const labels = app.findCollectionByNameOrId('user_labels');
		if (!labels.fields.getByName('conditions')) {
			labels.fields.add(
				new Field({
					hidden: false,
					id: 'json_user_labels_conditions',
					maxSize: 4000,
					name: 'conditions',
					presentable: false,
					required: false,
					system: false,
					type: 'json'
				})
			);
			app.save(labels);
		}
	},
	(app) => {
		const labels = app.findCollectionByNameOrId('user_labels');
		labels.fields.removeByName('conditions');
		app.save(labels);
	}
);
