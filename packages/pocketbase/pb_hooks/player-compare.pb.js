/// <reference path="../pb_data/types.d.ts" />

'use strict';

routerAdd('OPTIONS', '/api/player-compare', (e) => {
	return require(`${__hooks}/lib/player-compare.js`).handleOptions(e);
});

routerAdd('GET', '/api/player-compare', (e) => {
	return require(`${__hooks}/lib/player-compare.js`).handleCompare(e);
});

routerAdd('OPTIONS', '/api/player-compare/h2h', (e) => {
	return require(`${__hooks}/lib/player-compare.js`).handleOptions(e);
});

routerAdd('GET', '/api/player-compare/h2h', (e) => {
	return require(`${__hooks}/lib/player-compare.js`).handleH2hBatch(e);
});
