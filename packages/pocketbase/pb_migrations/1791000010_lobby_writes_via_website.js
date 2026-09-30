/// <reference path="../pb_data/types.d.ts" />

// Lobbies and live lobbies are written by the website (/api/v1/lobbies, /api/v1/live-lobbies);
// older apps' direct collection writes reach it through the api-gateway. The
// website writes as superuser, so the collections close to everyone else.
// Deploy after the website and the gateway routes for these paths.
const PREVIOUS = {
	lobbies: {
		createRule: '',
		updateRule:
			'(@request.auth.id != "") && @request.body.likeCount:isset = false && @request.body.commentCount:isset = false && @request.body.downloadCount:isset = false',
		deleteRule: '@request.auth.id = user'
	},
	lobbies_live: {
		createRule: '@request.body.user = @request.auth.id',
		updateRule: 'user = @request.auth.id',
		deleteRule: 'user = @request.auth.id'
	}
};

migrate(
	(app) => {
		for (const name of Object.keys(PREVIOUS)) {
			const collection = app.findCollectionByNameOrId(name);
			collection.createRule = null;
			collection.updateRule = null;
			collection.deleteRule = null;
			app.save(collection);
		}
	},
	(app) => {
		for (const [name, rules] of Object.entries(PREVIOUS)) {
			const collection = app.findCollectionByNameOrId(name);
			Object.assign(collection, rules);
			app.save(collection);
		}
	}
);
