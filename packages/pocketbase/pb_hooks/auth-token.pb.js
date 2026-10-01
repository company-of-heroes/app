/// <reference path="../pb_data/types.d.ts" />

'use strict';

// A regular (refreshable) auth session for a user, issued for the website after
// it verified who the user is (Steam login, login handoff, staff impersonation).
// PocketBase's own impersonate tokens cannot be refreshed, hence this route.
// This route only issues the session; all logic lives on the website.
//
// It can sign in as anyone, so it has its own secret (AUTH_TOKEN_SECRET; SERVICE_TOKEN
// until that is set), shared only with the website.
//
// POST /api/_auth/token  { "userId": "…" }  ->  { "token", "record" }
routerAdd('POST', '/api/_auth/token', (e) => {
	const token = $os.getenv('AUTH_TOKEN_SECRET') || $os.getenv('SERVICE_TOKEN') || '';
	const header = e.request.header.get('Authorization') || '';
	if (!token || !$security.equal(header, `Bearer ${token}`)) {
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
