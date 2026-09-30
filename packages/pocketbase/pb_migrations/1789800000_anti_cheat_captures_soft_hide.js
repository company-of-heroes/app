/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		let collection;
		try {
			collection = app.findCollectionByNameOrId('anti_cheat_captures');
		} catch {
			return;
		}

		const staff = '@request.auth.role = "admin" || @request.auth.role = "moderator"';

		if (!collection.fields.getByName('hidden')) {
			collection.fields.add(
				new BoolField({
					hidden: false,
					id: 'bool_ac_captures_hidden',
					name: 'hidden',
					presentable: false,
					required: false,
					system: false
				})
			);
		}

		if (!collection.fields.getByName('hiddenAt')) {
			collection.fields.add(
				new DateField({
					hidden: false,
					id: 'date_ac_captures_hidden_at',
					max: '',
					min: '',
					name: 'hiddenAt',
					presentable: false,
					required: false,
					system: false
				})
			);
		}

		if (!collection.fields.getByName('hiddenBy')) {
			collection.fields.add(
				new RelationField({
					cascadeDelete: false,
					collectionId: '_pb_users_auth_',
					hidden: false,
					id: 'relation_ac_captures_hidden_by',
					maxSelect: 1,
					minSelect: 0,
					name: 'hiddenBy',
					presentable: false,
					required: false,
					system: false
				})
			);
		}

		collection.listRule = `hidden != true || ${staff}`;
		collection.viewRule = `hidden != true || ${staff}`;

		app.save(collection);
	},
	(app) => {
		let collection;
		try {
			collection = app.findCollectionByNameOrId('anti_cheat_captures');
		} catch {
			return;
		}

		const authed = '@request.auth.id != ""';
		collection.listRule = authed;
		collection.viewRule = authed;

		for (const name of ['hiddenBy', 'hiddenAt', 'hidden']) {
			if (collection.fields.getByName(name)) {
				collection.fields.removeByName(name);
			}
		}

		app.save(collection);
	}
);
