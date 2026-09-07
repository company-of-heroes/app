/// <reference path="../pb_data/types.d.ts" />

'use strict';

/**
 * Block direct email field writes on users.update.
 * Clients must use requestEmailChange / confirmEmailChange instead.
 */
onRecordUpdateRequest((e) => {
	if (e.hasSuperuserAuth()) {
		return e.next();
	}

	const original = e.record.original();
	const nextEmail = String(e.record.get('email') || '');
	const prevEmail = String(original.get('email') || '');
	if (nextEmail !== prevEmail) {
		throw new BadRequestError('Use the email change confirmation flow to update your email.');
	}

	e.next();
}, 'users');
