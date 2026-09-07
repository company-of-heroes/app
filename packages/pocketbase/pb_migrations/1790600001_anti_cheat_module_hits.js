/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		try {
			app.findCollectionByNameOrId('anti_cheat_module_hits');
			return;
		} catch {
			// create below
		}

		const staff = '@request.auth.role = "admin" || @request.auth.role = "moderator"';
		const ownOrStaff = `user = @request.auth.id || ${staff}`;

		const collection = new Collection({
			createRule: '@request.auth.id != "" && @request.body.user = @request.auth.id',
			deleteRule: staff,
			listRule: ownOrStaff,
			viewRule: ownOrStaff,
			updateRule: staff,
			name: 'anti_cheat_module_hits',
			type: 'base',
			fields: [
				{
					autogeneratePattern: '[a-z0-9]{15}',
					hidden: false,
					id: 'text_ac_mod_hits_id',
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
					id: 'relation_ac_mod_hits_user',
					maxSelect: 1,
					minSelect: 1,
					name: 'user',
					presentable: false,
					required: true,
					system: false,
					type: 'relation'
				},
				{
					hidden: false,
					id: 'number_ac_mod_hits_session_id',
					max: null,
					min: null,
					name: 'session_id',
					onlyInt: true,
					presentable: false,
					required: false,
					system: false,
					type: 'number'
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text_ac_mod_hits_module_name',
					max: 120,
					min: 1,
					name: 'module_name',
					pattern: '',
					presentable: true,
					primaryKey: false,
					required: true,
					system: false,
					type: 'text'
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text_ac_mod_hits_module_path',
					max: 520,
					min: 1,
					name: 'module_path',
					pattern: '',
					presentable: true,
					primaryKey: false,
					required: true,
					system: false,
					type: 'text'
				},
				{
					hidden: false,
					id: 'number_ac_mod_hits_pid',
					max: null,
					min: 0,
					name: 'pid',
					onlyInt: true,
					presentable: false,
					required: false,
					system: false,
					type: 'number'
				},
				{
					hidden: false,
					id: 'date_ac_mod_hits_detected_at',
					max: '',
					min: '',
					name: 'detected_at',
					presentable: false,
					required: false,
					system: false,
					type: 'date'
				},
				{
					hidden: false,
					id: 'autodate_ac_mod_hits_created',
					name: 'created',
					onCreate: true,
					onUpdate: false,
					presentable: false,
					system: false,
					type: 'autodate'
				},
				{
					hidden: false,
					id: 'autodate_ac_mod_hits_updated',
					name: 'updated',
					onCreate: true,
					onUpdate: true,
					presentable: false,
					system: false,
					type: 'autodate'
				}
			],
			indexes: [
				'CREATE INDEX `idx_ac_mod_hits_user_session` ON `anti_cheat_module_hits` (`user`, `session_id`)',
				'CREATE INDEX `idx_ac_mod_hits_detected` ON `anti_cheat_module_hits` (`detected_at`)'
			]
		});

		return app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('anti_cheat_module_hits');
		return app.delete(collection);
	}
);
