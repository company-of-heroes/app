/// <reference path="../pb_data/types.d.ts" />

'use strict';

routerAdd('OPTIONS', '/api/player-customization/{steamId}', (e) => {
	return require(`${__hooks}/lib/player-customization.js`).handleOptions(e);
});

routerAdd('GET', '/api/player-customization/{steamId}', (e) => {
	return require(`${__hooks}/lib/player-customization.js`).handleGet(e);
});

routerAdd('OPTIONS', '/api/player-customization', (e) => {
	return require(`${__hooks}/lib/player-customization.js`).handleOptions(e);
});

routerAdd(
	'POST',
	'/api/player-customization',
	(e) => {
		return require(`${__hooks}/lib/player-customization.js`).handleUpdate(e);
	},
	$apis.requireAuth('users')
);
