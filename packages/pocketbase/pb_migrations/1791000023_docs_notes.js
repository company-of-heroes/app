/// <reference path="../pb_data/types.d.ts" />

// Staff tips ("when to use it") on the website docs pages, one per documented item.
// Public read; writes go through the website (superuser), which checks the staff role.
migrate(
	(app) => {
		try {
			app.findCollectionByNameOrId('docs_notes');
			return;
		} catch {
			// create below
		}

		const collection = new Collection({
			createRule: null,
			deleteRule: null,
			listRule: '',
			viewRule: '',
			updateRule: null,
			name: 'docs_notes',
			type: 'base',
			indexes: ['CREATE UNIQUE INDEX `idx_docs_notes_kind_slug` ON `docs_notes` (`kind`, `slug`)'],
			fields: [
				{
					autogeneratePattern: '[a-z0-9]{15}',
					hidden: false,
					id: 'text_docs_notes_id',
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
					hidden: false,
					id: 'select_docs_notes_kind',
					maxSelect: 1,
					name: 'kind',
					presentable: false,
					required: true,
					system: false,
					type: 'select',
					values: ['unit', 'building', 'commander', 'weapon']
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text_docs_notes_slug',
					max: 120,
					min: 1,
					name: 'slug',
					pattern: '^[a-z0-9-]+$',
					presentable: true,
					primaryKey: false,
					required: true,
					system: false,
					type: 'text'
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text_docs_notes_body',
					max: 5000,
					min: 0,
					name: 'body',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				},
				{
					cascadeDelete: false,
					collectionId: '_pb_users_auth_',
					hidden: false,
					id: 'relation_docs_notes_updated_by',
					maxSelect: 1,
					minSelect: 0,
					name: 'updatedBy',
					presentable: false,
					required: false,
					system: false,
					type: 'relation'
				},
				{
					hidden: false,
					id: 'autodate_docs_notes_created',
					name: 'created',
					onCreate: true,
					onUpdate: false,
					presentable: false,
					system: false,
					type: 'autodate'
				},
				{
					hidden: false,
					id: 'autodate_docs_notes_updated',
					name: 'updated',
					onCreate: true,
					onUpdate: true,
					presentable: false,
					system: false,
					type: 'autodate'
				}
			]
		});

		return app.save(collection);
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('docs_notes'));
		} catch {
			// already gone
		}
	}
);
