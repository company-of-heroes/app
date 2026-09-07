/// <reference path="../pb_data/types.d.ts" />

/**
 * Point verification / email-change links at coh1stats.com (not the PB admin SPA).
 */
migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('_pb_users_auth_');
		users.verificationTemplate = {
			subject: 'Verify your {APP_NAME} email',
			body: '<p>Hello,</p>\n<p>Thank you for joining us at {APP_NAME}.</p>\n<p>Click on the button below to verify your email address.</p>\n<p>\n  <a class="btn" href="https://coh1stats.com/auth/confirm-verification?token={TOKEN}" target="_blank" rel="noopener">Verify</a>\n</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>'
		};
		users.confirmEmailChangeTemplate = {
			subject: 'Confirm your {APP_NAME} new email address',
			body: '<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n  <a class="btn" href="https://coh1stats.com/auth/confirm-email-change?token={TOKEN}" target="_blank" rel="noopener">Confirm new email</a>\n</p>\n<p><i>If you didn\'t ask to change your email address, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>'
		};
		app.save(users);
	},
	(app) => {
		const users = app.findCollectionByNameOrId('_pb_users_auth_');
		users.verificationTemplate = {
			subject: 'Verify your {APP_NAME} email',
			body: '<p>Hello,</p>\n<p>Thank you for joining us at {APP_NAME}.</p>\n<p>Click on the button below to verify your email address.</p>\n<p>\n  <a class="btn" href="{APP_URL}/_/#/auth/confirm-verification/{TOKEN}" target="_blank" rel="noopener">Verify</a>\n</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>'
		};
		users.confirmEmailChangeTemplate = {
			subject: 'Confirm your {APP_NAME} new email address',
			body: '<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n  <a class="btn" href="{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}" target="_blank" rel="noopener">Confirm new email</a>\n</p>\n<p><i>If you didn\'t ask to change your email address, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>'
		};
		app.save(users);
	}
);
