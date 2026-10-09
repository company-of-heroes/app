/// <reference path="../pb_data/types.d.ts" />

// Community hosts: a `host` user role (create and run your own tournaments) and the requests
// people send to get it. Schema only.
const c = 'tournament_host_requests';

function setRoles(app, values) {
	const users = app.findCollectionByNameOrId('_pb_users_auth_');
	const role = users.fields.getByName('role');
	role.values = values;
	app.save(users);
}

migrate(
	(app) => {
		setRoles(app, ['admin', 'moderator', 'host']);

		try {
			app.findCollectionByNameOrId(c);
			return;
		} catch {
			// not there yet
		}

		// Read and written through the website (superuser), like the other tournament tables.
		app.save(
			new Collection({
				name: c,
				type: 'base',
				createRule: null,
				deleteRule: null,
				updateRule: null,
				listRule: null,
				viewRule: null,
				indexes: [
					'CREATE INDEX `idx_tournament_host_requests_status` ON `tournament_host_requests` (`status`, `created`)',
					'CREATE INDEX `idx_tournament_host_requests_user` ON `tournament_host_requests` (`user`, `created`)'
				],
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
						cascadeDelete: true,
						collectionId: '_pb_users_auth_',
						hidden: false,
						id: `relation_${c}_user`,
						maxSelect: 1,
						minSelect: 0,
						name: 'user',
						presentable: false,
						required: true,
						system: false,
						type: 'relation'
					},
					{
						autogeneratePattern: '',
						hidden: false,
						id: `text_${c}_message`,
						max: 2000,
						min: 0,
						name: 'message',
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
						id: `text_${c}_discord`,
						max: 100,
						min: 0,
						name: 'discord',
						pattern: '',
						presentable: false,
						primaryKey: false,
						required: false,
						system: false,
						type: 'text'
					},
					{
						hidden: false,
						id: `select_${c}_status`,
						maxSelect: 1,
						name: 'status',
						presentable: false,
						required: true,
						system: false,
						type: 'select',
						values: ['pending', 'approved', 'declined']
					},
					{
						autogeneratePattern: '',
						hidden: false,
						id: `text_${c}_staffNote`,
						max: 2000,
						min: 0,
						name: 'staffNote',
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
						id: `relation_${c}_handledBy`,
						maxSelect: 1,
						minSelect: 0,
						name: 'handledBy',
						presentable: false,
						required: false,
						system: false,
						type: 'relation'
					},
					{
						hidden: false,
						id: `date_${c}_handledAt`,
						max: '',
						min: '',
						name: 'handledAt',
						presentable: false,
						required: false,
						system: false,
						type: 'date'
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
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId(c));
		} catch {
			// already gone
		}

		setRoles(app, ['admin', 'moderator']);
	}
);
