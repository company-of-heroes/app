/// <reference path="../pb_data/types.d.ts" />

'use strict';

routerAdd('GET', '/api/anti-cheat/worker/batch', (e) => {
	return require(`${__hooks}/lib/anti-cheat-worker.js`).handleWorkerBatch(e);
});

routerAdd('PATCH', '/api/anti-cheat/worker/{id}', (e) => {
	return require(`${__hooks}/lib/anti-cheat-worker.js`).handleWorkerPatch(e);
});
