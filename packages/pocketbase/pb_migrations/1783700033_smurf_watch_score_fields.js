/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('smurf_watch');

		collection.fields.addAt(
			3,
			new Field({
				hidden: false,
				id: 'select_smurf_status',
				maxSelect: 1,
				name: 'status',
				presentable: false,
				required: true,
				system: false,
				type: 'select',
				values: [
					'pending_screening',
					'watching',
					'resolved',
					'not_smurf',
					'expired',
					'unknown_private'
				]
			})
		);

		const addField = (config) => {
			if (!collection.fields.getByName(config.name)) {
				collection.fields.add(new Field(config));
			}
		};

		addField({
			hidden: false,
			id: 'date_smurf_watching_since',
			max: '',
			min: '',
			name: 'watching_since',
			presentable: false,
			required: false,
			system: false,
			type: 'date'
		});

		addField({
			hidden: false,
			id: 'date_smurf_account_created',
			max: '',
			min: '',
			name: 'account_created_at',
			presentable: false,
			required: false,
			system: false,
			type: 'date'
		});

		addField({
			hidden: false,
			id: 'number_smurf_playtime',
			max: null,
			min: null,
			name: 'coh_playtime_min',
			onlyInt: true,
			presentable: false,
			required: false,
			system: false,
			type: 'number'
		});

		addField({
			hidden: false,
			id: 'number_smurf_game_bans',
			max: null,
			min: null,
			name: 'game_bans',
			onlyInt: true,
			presentable: false,
			required: false,
			system: false,
			type: 'number'
		});

		addField({
			hidden: false,
			id: 'bool_smurf_vac_banned',
			name: 'vac_banned',
			presentable: false,
			required: false,
			system: false,
			type: 'bool'
		});

		addField({
			hidden: false,
			id: 'number_smurf_relic_games',
			max: null,
			min: null,
			name: 'relic_total_games',
			onlyInt: true,
			presentable: false,
			required: false,
			system: false,
			type: 'number'
		});

		addField({
			hidden: false,
			id: 'number_smurf_relic_winrate',
			max: null,
			min: null,
			name: 'relic_winrate',
			onlyInt: false,
			presentable: false,
			required: false,
			system: false,
			type: 'number'
		});

		addField({
			hidden: false,
			id: 'number_smurf_relic_level',
			max: null,
			min: null,
			name: 'relic_level',
			onlyInt: true,
			presentable: false,
			required: false,
			system: false,
			type: 'number'
		});

		addField({
			hidden: false,
			id: 'json_smurf_signals',
			maxSize: 50000,
			name: 'signals',
			presentable: false,
			required: false,
			system: false,
			type: 'json'
		});

		addField({
			hidden: false,
			id: 'number_smurf_score',
			max: 100,
			min: 0,
			name: 'smurf_score',
			onlyInt: true,
			presentable: false,
			required: false,
			system: false,
			type: 'number'
		});

		addField({
			hidden: false,
			id: 'select_smurf_verdict',
			maxSelect: 1,
			name: 'verdict',
			presentable: false,
			required: false,
			system: false,
			type: 'select',
			values: ['confirmed_shared', 'likely_smurf', 'suspicious', 'clean', 'unknown']
		});

		addField({
			hidden: false,
			id: 'date_smurf_score_computed',
			max: '',
			min: '',
			name: 'score_computed_at',
			presentable: false,
			required: false,
			system: false,
			type: 'date'
		});

		addField({
			hidden: false,
			id: 'json_smurf_main_candidates',
			maxSize: 50000,
			name: 'main_candidates',
			presentable: false,
			required: false,
			system: false,
			type: 'json'
		});

		addField({
			hidden: false,
			id: 'text_smurf_suspected_main',
			autogeneratePattern: '',
			max: 20,
			min: 0,
			name: 'suspected_main_steam_id',
			pattern: '^[0-9]*$',
			presentable: false,
			primaryKey: false,
			required: false,
			system: false,
			type: 'text'
		});

		addField({
			hidden: false,
			id: 'number_smurf_main_confidence',
			max: 100,
			min: 0,
			name: 'main_confidence',
			onlyInt: true,
			presentable: false,
			required: false,
			system: false,
			type: 'number'
		});

		app.save(collection);

		// Records that were terminally marked not_smurf under the old
		// ownership-only logic never got a score; send them back to screening.
		app
			.db()
			.newQuery(
				`UPDATE smurf_watch
         SET status = 'pending_screening',
             next_check_at = strftime('%Y-%m-%d %H:%M:%fZ', 'now'),
             check_interval_sec = 300
         WHERE status = 'not_smurf'`
			)
			.execute();
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('smurf_watch');

		collection.fields.addAt(
			3,
			new Field({
				hidden: false,
				id: 'select_smurf_status',
				maxSelect: 1,
				name: 'status',
				presentable: false,
				required: true,
				system: false,
				type: 'select',
				values: ['pending_screening', 'watching', 'resolved', 'not_smurf']
			})
		);

		for (const name of [
			'watching_since',
			'account_created_at',
			'coh_playtime_min',
			'game_bans',
			'vac_banned',
			'relic_total_games',
			'relic_winrate',
			'relic_level',
			'signals',
			'smurf_score',
			'verdict',
			'score_computed_at',
			'main_candidates',
			'suspected_main_steam_id',
			'main_confidence'
		]) {
			if (collection.fields.getByName(name)) {
				collection.fields.removeByName(name);
			}
		}

		return app.save(collection);
	}
);
