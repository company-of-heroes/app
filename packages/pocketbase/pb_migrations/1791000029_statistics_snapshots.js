/// <reference path="../pb_data/types.d.ts" />

// Ready-made community statistics: the website's `statistics-snapshot` job stores the result
// of every preset period (and the headline totals) here, so pages read one small record
// instead of rebuilding from every match and replay on a cold cache. Superusers only.
migrate(
	(app) => {
		let exists = false;
		try {
			app.findCollectionByNameOrId('statistics_snapshots');
			exists = true;
		} catch {
			// create below
		}

		if (exists) {
			return;
		}

		app.save(
			new Collection({
				name: 'statistics_snapshots',
				type: 'base',
				listRule: null,
				viewRule: null,
				createRule: null,
				updateRule: null,
				deleteRule: null,
				indexes: [
					'CREATE UNIQUE INDEX `idx_statistics_snapshots_key` ON `statistics_snapshots` (`key`)'
				],
				fields: [
					{
						autogeneratePattern: '[a-z0-9]{15}',
						hidden: false,
						id: 'text_statistics_snapshots_id',
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
						id: 'text_statistics_snapshots_key',
						max: 50,
						min: 1,
						name: 'key',
						pattern: '',
						presentable: true,
						primaryKey: false,
						required: true,
						system: false,
						type: 'text'
					},
					{
						hidden: false,
						id: 'json_statistics_snapshots_data',
						maxSize: 20000000,
						name: 'data',
						presentable: false,
						required: false,
						system: false,
						type: 'json'
					},
					{
						hidden: false,
						id: 'autodate_statistics_snapshots_updated',
						name: 'updatedAt',
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
			app.delete(app.findCollectionByNameOrId('statistics_snapshots'));
		} catch {
			// already gone
		}
	}
);
