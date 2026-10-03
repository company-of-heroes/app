/// <reference path="../../pb_data/types.d.ts" />

'use strict';

/** Sends a PB_PING to every open realtime stream so idle proxies keep it open. */
function ping() {
	const message = new SubscriptionMessage({ name: 'PB_PING', data: '{}' });
	for (const chunk of $app.subscriptionsBroker().chunkedClients(300)) {
		for (const client of chunk) {
			if (!client.isDiscarded()) {
				client.send(message);
			}
		}
	}
}

module.exports = { ping };
