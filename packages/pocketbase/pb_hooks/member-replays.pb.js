/// <reference path="../pb_data/types.d.ts" />

'use strict';

routerAdd('OPTIONS', '/api/member-replays', (e) => {
	return require(`${__hooks}/lib/member-replays.js`).handleOptions(e);
});

routerAdd('GET', '/api/member-replays', (e) => {
	return require(`${__hooks}/lib/member-replays.js`).handleList(e);
});

routerAdd('POST', '/api/member-replays', (e) => {
	return require(`${__hooks}/lib/member-replays.js`).handleCreate(e);
});

routerAdd('OPTIONS', '/api/member-replays/maps', (e) => {
	return require(`${__hooks}/lib/member-replays.js`).handleOptions(e);
});

routerAdd('GET', '/api/member-replays/maps', (e) => {
	return require(`${__hooks}/lib/member-replays.js`).handleMaps(e);
});

routerAdd('OPTIONS', '/api/member-replays/preview-stats', (e) => {
	return require(`${__hooks}/lib/member-replays.js`).handleOptions(e);
});

routerAdd('POST', '/api/member-replays/preview-stats', (e) => {
	return require(`${__hooks}/lib/member-replays.js`).handlePreviewStats(e);
});

// Nested under /publish so it does not conflict with /{id}/delete or /{id}/download
// (Go mux treats from-match/{id} vs {id}/delete as ambiguous for .../from-match/delete).
routerAdd('OPTIONS', '/api/member-replays/from-match/{id}/publish', (e) => {
	return require(`${__hooks}/lib/member-replays.js`).handleOptions(e);
});

routerAdd(
	'POST',
	'/api/member-replays/from-match/{id}/publish',
	(e) => {
		return require(`${__hooks}/lib/member-replays.js`).handlePublishFromMatch(e);
	},
	$apis.requireAuth('users')
);

routerAdd('OPTIONS', '/api/member-replays/{id}', (e) => {
	return require(`${__hooks}/lib/member-replays.js`).handleOptions(e);
});

routerAdd('GET', '/api/member-replays/{id}', (e) => {
	return require(`${__hooks}/lib/member-replays.js`).handleGet(e);
});

routerAdd('PATCH', '/api/member-replays/{id}', (e) => {
	return require(`${__hooks}/lib/member-replays.js`).handleUpdate(e);
}, $apis.requireAuth('users'));

routerAdd('OPTIONS', '/api/member-replays/{id}/delete', (e) => {
	return require(`${__hooks}/lib/member-replays.js`).handleOptions(e);
});

routerAdd('POST', '/api/member-replays/{id}/delete', (e) => {
	return require(`${__hooks}/lib/member-replays.js`).handleSoftDelete(e);
}, $apis.requireAuth('users'));

routerAdd('DELETE', '/api/member-replays/{id}', (e) => {
	return require(`${__hooks}/lib/member-replays.js`).handleSoftDelete(e);
}, $apis.requireAuth('users'));

routerAdd('OPTIONS', '/api/member-replays/{id}/download', (e) => {
	return require(`${__hooks}/lib/member-replays.js`).handleOptions(e);
});

routerAdd('POST', '/api/member-replays/{id}/download', (e) => {
	return require(`${__hooks}/lib/member-replays.js`).handleDownload(e);
});

// Ensure existing analyzer uploads default to private when visibility is missing.
onRecordCreateRequest((e) => {
	const visibility = String(e.record.get('visibility') || '').trim();
	if (!visibility) {
		e.record.set('visibility', 'private');
	}

	if (e.record.get('likeCount') == null) {
		e.record.set('likeCount', 0);
	}
	if (e.record.get('downloadCount') == null) {
		e.record.set('downloadCount', 0);
	}
	if (e.record.get('commentCount') == null) {
		e.record.set('commentCount', 0);
	}

	e.next();
}, 'replays');
