'use strict';

const DEBUG_ENDPOINT =
	'http://host.docker.internal:7910/ingest/f592fdff-99b4-476b-bbb6-377d9aa053b3';
const SESSION_ID = 'a7bec5';

function debugLog(location, message, data, hypothesisId) {
	const payload = {
		sessionId: SESSION_ID,
		location,
		message,
		data: data || {},
		timestamp: Date.now(),
		hypothesisId: hypothesisId || ''
	};

	// #region agent log
	try {
		$http.send({
			url: DEBUG_ENDPOINT,
			method: 'POST',
			body: JSON.stringify(payload),
			headers: {
				'Content-Type': 'application/json',
				'X-Debug-Session-Id': SESSION_ID
			},
			timeout: 2
		});
	} catch {
		// host debug ingest may be unavailable outside docker
	}
	// #endregion

	console.log('[debug]', JSON.stringify(payload));
}

module.exports = { debugLog };
