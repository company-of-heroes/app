/// <reference path="../pb_data/types.d.ts" />

'use strict';

routerAdd('OPTIONS', '/api/player-card/{steamId}', (e) => {
	return require(`${__hooks}/lib/player-card.js`).handleOptions(e);
});

routerAdd('GET', '/api/player-card/{steamId}', (e) => {
	return require(`${__hooks}/lib/player-card.js`).handleGet(e);
});
