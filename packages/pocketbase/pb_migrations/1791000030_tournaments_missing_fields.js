/// <reference path="../pb_data/types.d.ts" />

// 1791000028_tournaments only creates collections that do not exist yet. Databases that ran
// an earlier version of it lack the tournament banner/logo and `tournament_maps`; PocketBase
// then drops uploaded images without an error. Adds whatever is missing (same definitions).

const image = (collection, name, maxSize, thumbs) => ({
	hidden: false,
	id: `file_${collection}_${name}`,
	maxSelect: 1,
	maxSize,
	mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
	name,
	presentable: false,
	protected: false,
	required: false,
	system: false,
	thumbs,
	type: 'file'
});

migrate(
	(app) => {
		const tournaments = app.findCollectionByNameOrId('tournaments');
		let changed = false;
		for (const field of [
			image('tournaments', 'banner', 5 * 1024 * 1024, ['1200x300']),
			image('tournaments', 'logo', 2 * 1024 * 1024, ['128x128'])
		]) {
			if (!tournaments.fields.getByName(field.name)) {
				tournaments.fields.add(new Field(field));
				changed = true;
			}
		}

		if (changed) {
			app.save(tournaments);
		}

		try {
			app.findCollectionByNameOrId('tournament_maps');
			return;
		} catch {
			// create below
		}

		const c = 'tournament_maps';
		app.save(
			new Collection({
				createRule: null,
				deleteRule: null,
				updateRule: null,
				listRule: '',
				viewRule: '',
				name: c,
				type: 'base',
				indexes: ['CREATE INDEX `idx_tournament_maps_name` ON `tournament_maps` (`name`)'],
				fields: [
					{
						autogeneratePattern: '[a-z0-9]{15}',
						hidden: false,
						id: `text_${c}_id`,
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
						id: `text_${c}_name`,
						max: 80,
						min: 0,
						name: 'name',
						pattern: '',
						presentable: true,
						primaryKey: false,
						required: true,
						system: false,
						type: 'text'
					},
					image(c, 'icon', 2 * 1024 * 1024, ['256x256']),
					{
						cascadeDelete: false,
						collectionId: '_pb_users_auth_',
						hidden: false,
						id: `relation_${c}_createdBy`,
						maxSelect: 1,
						minSelect: 0,
						name: 'createdBy',
						presentable: false,
						required: false,
						system: false,
						type: 'relation'
					},
					{
						hidden: false,
						id: `autodate_${c}_created`,
						name: 'created',
						onCreate: true,
						onUpdate: false,
						presentable: false,
						system: false,
						type: 'autodate'
					},
					{
						hidden: false,
						id: `autodate_${c}_updated`,
						name: 'updated',
						onCreate: true,
						onUpdate: true,
						presentable: false,
						system: false,
						type: 'autodate'
					}
				]
			})
		);
	},
	() => {
		// The fields belong to 1791000028_tournaments; its down migration removes them.
	}
);
