/// <reference path="../pb_data/types.d.ts" />

// Daily copy of each ranked Relic ladder (top 200: profile id, rank, wins, losses), written by
// the website's `leaderboard-snapshot` job. The leaderboard pages compare against it for rank
// movement (up / down / new since yesterday and last week). Superusers only.
migrate(
	(app) => {
		let exists = false;
		try {
			app.findCollectionByNameOrId('leaderboard_snapshots');
			exists = true;
		} catch {
			// create below
		}

		if (exists) {
			return;
		}

		app.save(
			new Collection({
				name: 'leaderboard_snapshots',
				type: 'base',
				listRule: null,
				viewRule: null,
				createRule: null,
				updateRule: null,
				deleteRule: null,
				indexes: [
					'CREATE UNIQUE INDEX `idx_leaderboard_snapshots_board_day` ON `leaderboard_snapshots` (`board`, `day`)'
				],
				fields: [
					{
						autogeneratePattern: '[a-z0-9]{15}',
						hidden: false,
						id: 'text_leaderboard_snapshots_id',
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
						id: 'number_leaderboard_snapshots_board',
						max: 19,
						min: 4,
						name: 'board',
						onlyInt: true,
						presentable: true,
						required: true,
						system: false,
						type: 'number'
					},
					{
						autogeneratePattern: '',
						hidden: false,
						id: 'text_leaderboard_snapshots_day',
						max: 10,
						min: 10,
						name: 'day',
						pattern: '^\\d{4}-\\d{2}-\\d{2}$',
						presentable: true,
						primaryKey: false,
						required: true,
						system: false,
						type: 'text'
					},
					{
						hidden: false,
						id: 'json_leaderboard_snapshots_rows',
						maxSize: 2000000,
						name: 'rows',
						presentable: false,
						required: false,
						system: false,
						type: 'json'
					},
					{
						hidden: false,
						id: 'autodate_leaderboard_snapshots_created',
						name: 'createdAt',
						onCreate: true,
						onUpdate: false,
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
			app.delete(app.findCollectionByNameOrId('leaderboard_snapshots'));
		} catch {
			// already gone
		}
	}
);
