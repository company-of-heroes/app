/// <reference path="../pb_data/types.d.ts" />

'use strict';

// Cloudflare closes a proxied response that sends nothing for ~100 seconds, and
// PocketBase realtime (SSE) is silent between record events. Chrome/WebView2 then
// report ERR_QUIC_PROTOCOL_ERROR (HTTP/3) and live updates stall until the SDK
// reconnects. A ping every minute keeps every open stream below that limit.
// Clients never subscribe to PB_PING, so the SDK ignores it.
$app.onServe().bindFunc((e) => {
	e.next();
	cronAdd('realtime_keepalive', '* * * * *', () => {
		require(`${__hooks}/lib/realtime-keepalive.js`).ping();
	});
});
