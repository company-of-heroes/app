/// <reference path="../pb_data/types.d.ts" />

// Guide reviews: any signed-in user writes guides, staff and editors publish them. An author
// asks for a review (`reviewRequestedAt`); changes to a published guide wait in `revision`
// (and `revisionCover`) until staff publish them. Schema only.
const FIELDS = [
	{
		hidden: false,
		id: 'json_guides_revision',
		maxSize: 200000,
		name: 'revision',
		presentable: false,
		required: false,
		system: false,
		type: 'json'
	},
	{
		hidden: false,
		id: 'file_guides_revisionCover',
		maxSelect: 1,
		maxSize: 5 * 1024 * 1024,
		mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
		name: 'revisionCover',
		presentable: false,
		protected: false,
		required: false,
		system: false,
		thumbs: ['1200x630', '600x0'],
		type: 'file'
	},
	{
		hidden: false,
		id: 'date_guides_reviewRequestedAt',
		max: '',
		min: '',
		name: 'reviewRequestedAt',
		presentable: false,
		required: false,
		system: false,
		type: 'date'
	}
];

migrate(
	(app) => {
		const guides = app.findCollectionByNameOrId('guides');
		let changed = false;
		for (const field of FIELDS) {
			if (!guides.fields.getByName(field.name)) {
				guides.fields.add(new Field(field));
				changed = true;
			}
		}

		if (changed) {
			app.save(guides);
		}
	},
	(app) => {
		const guides = app.findCollectionByNameOrId('guides');
		for (const field of FIELDS) {
			guides.fields.removeByName(field.name);
		}

		app.save(guides);
	}
);
