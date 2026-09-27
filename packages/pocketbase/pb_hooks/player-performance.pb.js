/// <reference path="../pb_data/types.d.ts" />

'use strict';

routerAdd('GET', '/api/player-performance', (e) => {
	const { loadPlayerPerformance } = require(`${__hooks}/lib/player-performance.js`);

	const query = e.request.url.query();
	const scope = query.get('scope') || 'user';
	const userId = query.get('userId') || '';
	const profileId = parseInt(query.get('profileId') || '', 10);

	if (!Number.isFinite(profileId) || profileId <= 0) {
		return e.json(400, { message: 'profileId required' });
	}

	if (scope !== 'user' && scope !== 'community') {
		return e.json(400, { message: 'invalid scope' });
	}

	if (scope === 'user' && !userId) {
		return e.json(400, { message: 'userId required for user scope' });
	}

	const startedAt = Number(new Date());
	const timings = {};

	try {
		const data = loadPlayerPerformance(
			profileId,
			scope,
			userId,
			timings,
			query.get('fresh') === '1'
		);

		// Cache hits are the common case and say nothing about query cost.
		if (timings.cache === 'miss') {
			console.log(
				`[player_performance] scope=${scope} profileId=${profileId}` +
					` aggregate_ms=${timings.aggregateMs ?? 0} recent_ms=${timings.recentMs ?? 0}` +
					` total_ms=${Number(new Date()) - startedAt} matches=${data.matchCount}`
			);
		}

		return e.json(200, data);
	} catch (error) {
		console.warn('[player_performance] query failed:', String(error?.message || error));
		return e.json(500, { message: 'Failed to load player performance' });
	}
});
