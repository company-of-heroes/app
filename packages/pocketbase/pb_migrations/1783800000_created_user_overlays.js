/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
	try {
		app.findCollectionByNameOrId('user_overlays');
		return;
	} catch {
		// create below
	}

	const collection = new Collection({
		createRule: '@request.body.user = @request.auth.id',
		deleteRule: 'user = @request.auth.id',
		listRule: '',
		viewRule: '',
		updateRule: 'user = @request.auth.id',
		name: 'user_overlays',
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
				cascadeDelete: true,
				collectionId: '_pb_users_auth_',
				hidden: false,
				id: 'relation_user_overlays_user',
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
				id: 'file_user_overlays_bundle',
				maxSelect: 1,
				maxSize: 10485760,
				mimeTypes: ['application/zip', 'application/x-zip-compressed'],
				name: 'bundle',
				presentable: false,
				protected: false,
				required: false,
				system: false,
				type: 'file'
			},
			{
				hidden: false,
				id: 'text_user_overlays_version',
				max: 50,
				min: 0,
				name: 'version',
				presentable: false,
				required: false,
				system: false,
				type: 'text'
			},
			{
				hidden: false,
				id: 'autodate_user_overlays_updated',
				name: 'updated',
				onCreate: true,
				onUpdate: true,
				presentable: false,
				system: false,
				type: 'autodate'
			}
		],
		indexes: ['CREATE UNIQUE INDEX `idx_user_overlays_user` ON `user_overlays` (`user`)']
	});

	return app.save(collection);
}, (app) => {
	const collection = app.findCollectionByNameOrId('user_overlays');
	return app.delete(collection);
});
