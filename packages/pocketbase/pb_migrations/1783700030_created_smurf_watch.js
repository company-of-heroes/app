/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		try {
			app.findCollectionByNameOrId('smurf_watch');
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
			name: 'smurf_watch',
			type: 'base',
			fields: [
				{
					autogeneratePattern: '[a-z0-9]{15}',
					hidden: false,
					id: 'text3208210256',
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
					id: 'text_smurf_steam_id',
					max: 20,
					min: 17,
					name: 'steam_id',
					pattern: '^[0-9]+$',
					presentable: true,
					primaryKey: false,
					required: true,
					system: false,
					type: 'text'
				},
				{
					hidden: false,
					id: 'number_smurf_profile_id',
					max: null,
					min: null,
					name: 'profile_id',
					onlyInt: true,
					presentable: false,
					required: false,
					system: false,
					type: 'number'
				},
				{
					hidden: false,
					id: 'select_smurf_status',
					maxSelect: 1,
					name: 'status',
					presentable: false,
					required: true,
					system: false,
					type: 'select',
					values: ['pending_screening', 'watching', 'resolved', 'not_smurf']
				},
				{
					hidden: false,
					id: 'select_smurf_source',
					maxSelect: 1,
					name: 'source',
					presentable: false,
					required: true,
					system: false,
					type: 'select',
					values: ['profile', 'search', 'lobby_live', 'lobby_match', 'backfill']
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text_smurf_lender_steam_id',
					max: 20,
					min: 0,
					name: 'lender_steam_id',
					pattern: '^[0-9]*$',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				},
				{
					hidden: false,
					id: 'select_smurf_lender_source',
					maxSelect: 1,
					name: 'lender_source',
					presentable: false,
					required: false,
					system: false,
					type: 'select',
					values: ['live', 'cohstats']
				},
				{
					hidden: false,
					id: 'bool_smurf_owns_coh',
					name: 'owns_coh',
					presentable: false,
					required: false,
					system: false,
					type: 'bool'
				},
				{
					hidden: false,
					id: 'date_smurf_last_checked',
					max: '',
					min: '',
					name: 'last_checked_at',
					presentable: false,
					required: false,
					system: false,
					type: 'date'
				},
				{
					hidden: false,
					id: 'date_smurf_next_check',
					max: '',
					min: '',
					name: 'next_check_at',
					presentable: false,
					required: false,
					system: false,
					type: 'date'
				},
				{
					hidden: false,
					id: 'number_smurf_check_interval',
					max: null,
					min: 60,
					name: 'check_interval_sec',
					onlyInt: false,
					presentable: false,
					required: false,
					system: false,
					type: 'number'
				},
				{
					hidden: false,
					id: 'number_smurf_priority',
					max: null,
					min: 0,
					name: 'priority',
					onlyInt: true,
					presentable: false,
					required: false,
					system: false,
					type: 'number'
				},
				{
					hidden: false,
					id: 'autodate2990389176',
					name: 'created',
					onCreate: true,
					onUpdate: false,
					presentable: false,
					system: false,
					type: 'autodate'
				},
				{
					hidden: false,
					id: 'autodate3332085495',
					name: 'updated',
					onCreate: true,
					onUpdate: true,
					presentable: false,
					system: false,
					type: 'autodate'
				}
			],
			indexes: [
				'CREATE UNIQUE INDEX `idx_smurf_watch_steam_id` ON `smurf_watch` (`steam_id`)',
				'CREATE INDEX `idx_smurf_watch_next_check` ON `smurf_watch` (`status`, `next_check_at`)',
				'CREATE INDEX `idx_smurf_watch_priority` ON `smurf_watch` (`status`, `priority`)'
			]
		});

		return app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('smurf_watch');
		return app.delete(collection);
	}
);
