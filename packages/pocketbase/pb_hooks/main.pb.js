/// <reference path="../pb_data/types.d.ts" />'

'use strict';
onBootstrap((e) => {
	const { debugLog } = require(`${__hooks}/lib/debug-log.js`);
	const bootstrapStart = Date.now();

	// #region agent log
	debugLog('main.pb.js:onBootstrap', 'bootstrap start', { bootstrapStart }, 'C');
	// #endregion

	e.next();
	require(`${__hooks}/handler.js`).default();

	// #region agent log
	debugLog(
		'main.pb.js:onBootstrap',
		'schema generation done',
		{ durationMs: Date.now() - bootstrapStart },
		'C'
	);
	// #endregion
});
onCollectionCreateRequest((e) => {
	e.next();
	require(`${__hooks}/handler.js`).default();
});
onCollectionUpdateRequest((e) => {
	e.next();
	require(`${__hooks}/handler.js`).default();
});
onCollectionDeleteRequest((e) => {
	e.next();
	require(`${__hooks}/handler.js`).default();
});
if (require(`${__hooks}/config.json`).exposeEndpoint) {
	routerUse($apis.gzip());
	if (require(`${__hooks}/config.json`).secureEndpoint) {
		routerAdd('GET', `${require(`${__hooks}/config.json`).endpointPath}`, (e) => {
			require(`${__hooks}/lib/endpoint.js`).secureEndpointHandler(e);
		});
		routerAdd('GET', '/logout', (e) => {
			require(`${__hooks}/lib/endpoint.js`).logout(e);
		});
	} else {
		routerAdd('GET', `${require(`${__hooks}/config.json`).endpointPath}`, (e) => {
			require(`${__hooks}/lib/endpoint.js`).renderSchema(e, false);
		});
	}
}

routerAdd('GET', '/hello/{name}', (e) => {
	let name = e.request.pathValue('name');

	return e.json(200, { message: 'Hello ' + name });
});

onRecordCreateRequest((e) => {
	if (e.hasSuperuserAuth()) {
		return e.next();
	}

	e.record.set('role', '');
	e.next();
}, 'users');

onRecordUpdateRequest((e) => {
	if (e.hasSuperuserAuth()) {
		return e.next();
	}

	const original = e.record.original();
	e.record.set('role', original.get('role'));
	e.next();
}, 'users');
