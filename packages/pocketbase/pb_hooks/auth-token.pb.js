/// <reference path="../pb_data/types.d.ts" />

'use strict';

// A regular (refreshable) auth session for a user, issued for the website after
// it verified who the user is (Steam login, login handoff, staff impersonation).
// PocketBase's own impersonate tokens cannot be refreshed, hence this route.
// This route only issues the session; all logic lives on the website.
//
// POST /api/_auth/token  { "userId": "…" }  ->  { "token", "record" }
routerAdd('POST', '/api/_auth/token', (e) => {
	const token = $os.getenv('SERVICE_TOKEN') || '';
	if (!token || e.request.header.get('Authorization') !== `Bearer ${token}`) {
		return e.json(401, { message: 'Unauthorized' });
	}

	const userId = String(e.requestInfo().body?.userId || '');
	let user;
	try {
		user = $app.findRecordById('users', userId);
	} catch {
		return e.json(404, { message: 'User not found' });
	}

	return $apis.recordAuthResponse(e, user);
});
