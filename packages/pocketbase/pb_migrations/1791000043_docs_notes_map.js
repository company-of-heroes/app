/// <reference path="../pb_data/types.d.ts" />

// Staff tips on the wiki map pages (`/wiki/maps/<slug>`). Schema only.
function setKinds(app, values) {
	const collection = app.findCollectionByNameOrId('docs_notes');
	const kind = collection.fields.getByName('kind');
	kind.values = values;
	app.save(collection);
}

migrate(
	(app) => {
		setKinds(app, ['unit', 'building', 'commander', 'weapon', 'map']);
	},
	(app) => {
		setKinds(app, ['unit', 'building', 'commander', 'weapon']);
	}
);
