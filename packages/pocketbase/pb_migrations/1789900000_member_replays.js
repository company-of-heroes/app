/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const replays = app.findCollectionByNameOrId('replays');

		const addField = (config) => {
			if (!replays.fields.getByName(config.name)) {
				replays.fields.add(new Field(config));
			}
		};

		addField({
			hidden: false,
			id: 'select_replays_visibility',
			maxSelect: 1,
			name: 'visibility',
			presentable: false,
			required: false,
			system: false,
			type: 'select',
			values: ['private', 'member']
		});

		addField({
			autogeneratePattern: '',
			hidden: false,
			id: 'text_replays_description',
			max: 2000,
			min: 0,
			name: 'description',
			pattern: '',
			presentable: false,
			primaryKey: false,
			required: false,
			system: false,
			type: 'text'
		});

		addField({
			hidden: false,
			id: 'number_replays_like_count',
			max: null,
			min: 0,
			name: 'likeCount',
			onlyInt: true,
			presentable: false,
			required: false,
			system: false,
			type: 'number'
		});

		addField({
			hidden: false,
			id: 'number_replays_download_count',
			max: null,
			min: 0,
			name: 'downloadCount',
			onlyInt: true,
			presentable: false,
			required: false,
			system: false,
			type: 'number'
		});

		addField({
			hidden: false,
			id: 'number_replays_comment_count',
			max: null,
			min: 0,
			name: 'commentCount',
			onlyInt: true,
			presentable: false,
			required: false,
			system: false,
			type: 'number'
		});

		replays.listRule = 'visibility = "member" || createdBy = @request.auth.id';
		replays.viewRule = 'visibility = "member" || createdBy = @request.auth.id';

		const indexes = Array.isArray(replays.indexes) ? [...replays.indexes] : [];
		const memberIndex =
			'CREATE INDEX `idx_replays_member_created` ON `replays` (`createdAt`) WHERE `visibility` = "member"';
		if (!indexes.includes(memberIndex)) {
			indexes.push(memberIndex);
		}

		replays.indexes = indexes;

		app.save(replays);

		try {
			app.findCollectionByNameOrId('member_replay_download_fingerprints');
		} catch {
			const fingerprints = new Collection({
				createRule: null,
				deleteRule: null,
				listRule: null,
				viewRule: null,
				updateRule: null,
				name: 'member_replay_download_fingerprints',
				type: 'base',
				id: 'pbc_9182736451',
				indexes: [
					'CREATE UNIQUE INDEX `idx_member_replay_dl_fp` ON `member_replay_download_fingerprints` (`replay`, `fingerprint`)',
					'CREATE INDEX `idx_member_replay_dl_replay` ON `member_replay_download_fingerprints` (`replay`)'
				],
				fields: [
					{
						autogeneratePattern: '[a-z0-9]{15}',
						hidden: false,
						id: 'text_member_replay_dl_id',
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
						collectionId: 'pbc_3644265509',
						hidden: false,
						id: 'relation_member_replay_dl_replay',
						maxSelect: 1,
						minSelect: 1,
						name: 'replay',
						presentable: false,
						required: true,
						system: false,
						type: 'relation'
					},
					{
						autogeneratePattern: '',
						hidden: false,
						id: 'text_member_replay_dl_fp',
						max: 64,
						min: 64,
						name: 'fingerprint',
						pattern: '^[a-f0-9]+$',
						presentable: false,
						primaryKey: false,
						required: true,
						system: false,
						type: 'text'
					},
					{
						hidden: false,
						id: 'autodate_member_replay_dl_created',
						name: 'created',
						onCreate: true,
						onUpdate: false,
						presentable: false,
						system: false,
						type: 'autodate'
					},
					{
						hidden: false,
						id: 'autodate_member_replay_dl_updated',
						name: 'updated',
						onCreate: true,
						onUpdate: true,
						presentable: false,
						system: false,
						type: 'autodate'
					}
				]
			});
			app.save(fingerprints);
		}
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('member_replay_download_fingerprints'));
		} catch {
			// already gone
		}

		try {
			const replays = app.findCollectionByNameOrId('replays');
			for (const name of [
				'visibility',
				'description',
				'likeCount',
				'downloadCount',
				'commentCount'
			]) {
				if (replays.fields.getByName(name)) {
					replays.fields.removeByName(name);
				}
			}
			replays.listRule = '';
			replays.viewRule = '';
			replays.indexes = (Array.isArray(replays.indexes) ? replays.indexes : []).filter(
				(index) => !String(index).includes('idx_replays_member_created')
			);
			app.save(replays);
		} catch {
			// already gone
		}
	}
);
