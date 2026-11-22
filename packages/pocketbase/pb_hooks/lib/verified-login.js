'use strict';

const PLACEHOLDER_DOMAIN = '@fknoobs.com';
const RESEND_AFTER_MS = 10 * 60 * 1000;
/** The website shows this message (an i18n key) on its login page. */
const UNVERIFIED_MESSAGE =
	'Verify your email address before logging in. We sent you a new verification link.';

function handleAuth(e) {
	const record = e.record;
	if (
		!record ||
		record.getBool('verified') ||
		record.email().toLowerCase().endsWith(PLACEHOLDER_DOMAIN) ||
		!record.validatePassword(e.password)
	) {
		return e.next();
	}

	const key = `verified-login:${record.id}`;
	const last = $app.store().get(key) || 0;
	if (Date.now() - last > RESEND_AFTER_MS) {
		$app.store().set(key, Date.now());
		try {
			$mails.sendRecordVerification($app, record);
		} catch (error) {
			console.error('[verified-login] verification mail failed', record.id, error);
		}
	}

	throw new ForbiddenError(UNVERIFIED_MESSAGE);
}

module.exports = { handleAuth };
