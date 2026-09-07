/// <reference path="../pb_data/types.d.ts" />

'use strict';

routerAdd('OPTIONS', '/api/lobbies/{id}/attach-replay', (e) => {
	return require(`${__hooks}/lib/lobby-attach-replay.js`).handleOptions(e);
});

routerAdd(
	'POST',
	'/api/lobbies/{id}/attach-replay',
	(e) => {
		return require(`${__hooks}/lib/lobby-attach-replay.js`).handleAttach(e);
	},
	$apis.requireAuth('users')
);

// Older clients attach temp.rec via collection update; keep that path working
// for match participants (see guardLegacyCollectionUpdate).
onRecordUpdateRequest((e) => {
	require(`${__hooks}/lib/lobby-attach-replay.js`).guardLegacyCollectionUpdate(e);
}, 'lobbies');
