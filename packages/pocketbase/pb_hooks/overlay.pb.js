/// <reference path="../pb_data/types.d.ts" />

'use strict';

routerAdd('GET', '/overlay/{userId}', (e) => {
	const overlay = require(`${__hooks}/lib/overlay.js`);
	const userId = e.request.pathValue('userId');

	if (!overlay.isValidUserId(userId)) {
		throw new NotFoundError('Not found');
	}

	return e.redirect(301, `/overlay/${userId}/`);
});

routerAdd('GET', '/overlay/{userId}/{$}', (e) => {
	return require(`${__hooks}/lib/overlay.js`).handleGetOverlayIndex(e);
});

routerAdd('GET', '/overlay/{userId}/{path...}', (e) => {
	return require(`${__hooks}/lib/overlay.js`).handleGetOverlay(e);
});

routerAdd(
	'POST',
	'/api/overlay/publish',
	(e) => {
		return require(`${__hooks}/lib/overlay.js`).handlePublish(e);
	},
	$apis.requireAuth('users')
);
