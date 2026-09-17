/// <reference path="../../pb_data/types.d.ts" />

'use strict';

// Vision analysis was retired in favor of community screenshot review.
// `analysis_status` / `analysis_score` / `analysis_notes` were removed from
// `anti_cheat_captures`, but `fknoobs-anti-cheat-worker` may still be cron'd.
// Keep these routes alive with empty/410 responses so CF logs stay clean until
// that worker is disabled.

function getServiceToken() {
	return $os.getenv('ANTI_CHEAT_SERVICE_TOKEN') || $os.getenv('SMURF_SERVICE_TOKEN') || '';
}

function isServiceRequest(e) {
	const token = getServiceToken();
	if (!token) {
		return false;
	}

	const auth = e.request.header.get('Authorization') || '';
	return auth === `Bearer ${token}`;
}

function handleWorkerBatch(e) {
	if (!isServiceRequest(e)) {
		return e.json(401, { message: 'Unauthorized' });
	}

	return e.json(200, {
		items: [],
		captures: [],
		fetched_at: new Date().toISOString(),
		total_pending: 0,
		retired: true
	});
}

function handleWorkerPatch(e) {
	if (!isServiceRequest(e)) {
		return e.json(401, { message: 'Unauthorized' });
	}

	return e.json(410, {
		message: 'Anti-cheat vision analysis is retired; analysis fields were removed from captures'
	});
}

module.exports = {
	handleWorkerBatch,
	handleWorkerPatch
};
