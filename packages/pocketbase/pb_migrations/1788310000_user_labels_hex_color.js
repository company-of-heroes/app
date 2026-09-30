/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
	let collection;
	try {
		collection = app.findCollectionByNameOrId('user_labels');
	} catch {
		return;
	}

	const color = collection.fields.getByName('color');
	if (!color || color.type === 'text') {
		return;
	}

	collection.fields.removeByName('color');
	collection.fields.add(
		new Field({
			autogeneratePattern: '',
			hidden: false,
			id: 'text_user_labels_color',
			max: 7,
			min: 4,
			name: 'color',
			pattern: '^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$',
			presentable: true,
			primaryKey: false,
			required: true,
			system: false,
			type: 'text'
		})
	);

	return app.save(collection);
});
