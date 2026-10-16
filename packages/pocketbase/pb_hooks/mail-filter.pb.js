/// <reference path="../pb_data/types.d.ts" />

'use strict';

// Never mail the generated `@fknoobs.com` placeholder addresses (auth alerts,
// verification, password reset, ...). Every outgoing email passes through here.
onMailerSend((e) => {
	return require(`${__hooks}/lib/mail-filter.js`).handleSend(e);
});
