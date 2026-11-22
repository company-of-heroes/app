/// <reference path="../pb_data/types.d.ts" />

'use strict';

// Password login needs a verified email. A correct password on an unverified account
// sends a new verification link (at most once per 10 minutes) instead of a session.
// Generated `@fknoobs.com` placeholders (anonymous app accounts) cannot be verified and
// are let through; Steam logins use /api/_auth/token and never get here.
onRecordAuthWithPasswordRequest((e) => {
	return require(`${__hooks}/lib/verified-login.js`).handleAuth(e);
}, 'users');
