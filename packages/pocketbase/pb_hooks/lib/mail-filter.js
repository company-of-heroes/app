'use strict';

// Accounts without a real email get a generated `@fknoobs.com` placeholder. That
// domain has no inbox, so mail to it only bounces and hurts sender reputation.
const PLACEHOLDER_DOMAIN = '@fknoobs.com';

function isPlaceholder(recipient) {
	return String(recipient.address || '')
		.toLowerCase()
		.endsWith(PLACEHOLDER_DOMAIN);
}

function realRecipients(list) {
	return (list || []).filter((recipient) => !isPlaceholder(recipient));
}

// Drops placeholder recipients; skips the send when nobody real is left.
function handleSend(e) {
	const message = e.message;
	if (!message) {
		return e.next();
	}

	message.to = realRecipients(message.to);
	message.cc = realRecipients(message.cc);
	message.bcc = realRecipients(message.bcc);
	if (message.to.length === 0 && message.cc.length === 0 && message.bcc.length === 0) {
		return;
	}

	return e.next();
}

module.exports = { handleSend };
