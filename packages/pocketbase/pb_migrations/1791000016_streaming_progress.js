/// <reference path="../pb_data/types.d.ts" />

// Lifetime Company of Heroes streaming time per account (desktop reports while live
// and the game runs). The website writes rows and grants the Streamer label at 12h.
migrate(
	(app) => {
		try {
			app.findCollectionByNameOrId('streaming_progress');
			return;
		} catch {
			// create below
		}

		const own = 'user = @request.auth.id';
		const collection = new Collection({
			createRule: null,
			deleteRule: null,
			listRule: own,
			viewRule: own,
			updateRule: null,
			name: 'streaming_progress',
			type: 'base',
			id: 'pbc_streaming_progress',
			indexes: [
				'CREATE UNIQUE INDEX `idx_streaming_progress_user` ON `streaming_progress` (`user`)'
			],
			fields: [
				{
					autogeneratePattern: '[a-z0-9]{15}',
					hidden: false,
					id: 'text_streaming_progress_id',
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
					id: 'relation_streaming_progress_user',
					maxSelect: 1,
					minSelect: 0,
					name: 'user',
					presentable: false,
					required: true,
					system: false,
					type: 'relation'
				},
				{
					hidden: false,
					id: 'number_streaming_progress_ms',
					max: null,
					min: 0,
					name: 'streamedMs',
					onlyInt: true,
					presentable: false,
					required: false,
					system: false,
					type: 'number'
				},
				{
					hidden: false,
					id: 'date_streaming_progress_reported',
					max: '',
					min: '',
					name: 'lastReportAt',
					presentable: false,
					required: false,
					system: false,
					type: 'date'
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text_streaming_progress_twitch',
					max: 64,
					min: 0,
					name: 'twitchLogin',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				},
				{
					autogeneratePattern: '',
					hidden: false,
					id: 'text_streaming_progress_youtube',
					max: 64,
					min: 0,
					name: 'youtubeChannelId',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				},
				{
					hidden: false,
					id: 'bool_streaming_progress_granted',
					name: 'badgeGranted',
					presentable: false,
					required: false,
					system: false,
					type: 'bool'
				},
				{
					hidden: false,
					id: 'autodate_streaming_progress_created',
					name: 'created',
					onCreate: true,
					onUpdate: false,
					presentable: false,
					system: false,
					type: 'autodate'
				},
				{
					hidden: false,
					id: 'autodate_streaming_progress_updated',
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
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('streaming_progress'));
		} catch {
			// already removed
		}
	}
);
