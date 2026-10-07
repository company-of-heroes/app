/// <reference path="../pb_data/types.d.ts" />

// Wiki issue reports: a signed-in user tells staff that a wiki page is wrong.
// Writes go through the website (superuser), which also notifies admins and moderators.
// Staff list them and set the status in the app. Notifications get a `url` to link to the page.
const STAFF = '@request.auth.role = "admin" || @request.auth.role = "moderator"';

migrate(
	(app) => {
		let exists = false;
		try {
			app.findCollectionByNameOrId('docs_reports');
			exists = true;
		} catch {
			// create below
		}

		if (!exists) {
			const collection = new Collection({
				createRule: null,
				deleteRule: STAFF,
				listRule: STAFF,
				viewRule: STAFF,
				updateRule: STAFF,
				name: 'docs_reports',
				type: 'base',
				indexes: [
					'CREATE INDEX `idx_docs_reports_status` ON `docs_reports` (`status`, `created`)',
					'CREATE INDEX `idx_docs_reports_reporter` ON `docs_reports` (`reporter`, `created`)'
				],
				fields: [
					{
						autogeneratePattern: '[a-z0-9]{15}',
						hidden: false,
						id: 'text_docs_reports_id',
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
						collectionId: '_pb_users_auth_',
						hidden: false,
						id: 'relation_docs_reports_reporter',
						maxSelect: 1,
						minSelect: 0,
						name: 'reporter',
						presentable: false,
						required: true,
						system: false,
						type: 'relation'
					},
					{
						autogeneratePattern: '',
						hidden: false,
						id: 'text_docs_reports_page',
						max: 200,
						min: 0,
						name: 'page',
						pattern: '',
						presentable: true,
						primaryKey: false,
						required: false,
						system: false,
						type: 'text'
					},
					{
						autogeneratePattern: '',
						hidden: false,
						id: 'text_docs_reports_url',
						max: 500,
						min: 1,
						name: 'url',
						pattern: '',
						presentable: false,
						primaryKey: false,
						required: true,
						system: false,
						type: 'text'
					},
					{
						autogeneratePattern: '',
						hidden: false,
						id: 'text_docs_reports_description',
						max: 2000,
						min: 1,
						name: 'description',
						pattern: '',
						presentable: false,
						primaryKey: false,
						required: true,
						system: false,
						type: 'text'
					},
					{
						hidden: false,
						id: 'select_docs_reports_status',
						maxSelect: 1,
						name: 'status',
						presentable: false,
						required: true,
						system: false,
						type: 'select',
						values: ['open', 'resolved', 'dismissed']
					},
					{
						hidden: false,
						id: 'autodate_docs_reports_created',
						name: 'created',
						onCreate: true,
						onUpdate: false,
						presentable: false,
						system: false,
						type: 'autodate'
					},
					{
						hidden: false,
						id: 'autodate_docs_reports_updated',
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
		}

		const notifications = app.findCollectionByNameOrId('notifications');
		if (!notifications.fields.getByName('url')) {
			notifications.fields.add(
				new TextField({
					autogeneratePattern: '',
					hidden: false,
					id: 'text_notifications_url',
					max: 500,
					min: 0,
					name: 'url',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false
				})
			);
			app.save(notifications);
		}
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('docs_reports'));
		} catch {
			// already gone
		}

		try {
			const notifications = app.findCollectionByNameOrId('notifications');
			notifications.fields.removeByName('url');
			app.save(notifications);
		} catch {
			// already gone
		}
	}
);
