/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		try {
			app.findCollectionByNameOrId('anti_cheat_module_allowlist');
			return;
		} catch {
			// create below
		}

		const staff = '@request.auth.role = "admin" || @request.auth.role = "moderator"';

		const collection = new Collection({
			createRule: staff,
			deleteRule: staff,
			listRule: '@request.auth.id != ""',
			viewRule: '@request.auth.id != ""',
			updateRule: staff,
			name: 'anti_cheat_module_allowlist',
			type: 'base',
			fields: [
				{
					autogeneratePattern: '[a-z0-9]{15}',
					hidden: false,
					id: 'text_ac_mod_allow_id',
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
					id: 'text_ac_mod_allow_name',
					max: 260,
					min: 1,
					name: 'name',
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
					id: 'text_ac_mod_allow_label',
					max: 120,
					min: 0,
					name: 'label',
					pattern: '',
					presentable: true,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				},
				{
					hidden: false,
					id: 'bool_ac_mod_allow_enabled',
					name: 'enabled',
					presentable: false,
					required: false,
					system: false,
					type: 'bool'
				},
				{
					hidden: false,
					id: 'autodate_ac_mod_allow_created',
					name: 'created',
					onCreate: true,
					onUpdate: false,
					presentable: false,
					system: false,
					type: 'autodate'
				},
				{
					hidden: false,
					id: 'autodate_ac_mod_allow_updated',
					name: 'updated',
					onCreate: true,
					onUpdate: true,
					presentable: false,
					system: false,
					type: 'autodate'
				}
			],
			indexes: [
				'CREATE UNIQUE INDEX `idx_ac_mod_allow_name` ON `anti_cheat_module_allowlist` (`name`)'
			]
		});

		return app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('anti_cheat_module_allowlist');
		return app.delete(collection);
	}
);
