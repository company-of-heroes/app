'use strict';

/**
 * User-scoped history search must use the authenticated account.
 * Query userId is ignored so callers cannot enumerate another user's play graph.
 */
function resolveHistoryUserId(e, scope) {
	if (scope !== 'user') {
		return { userId: '' };
	}

	if (!e.auth || !e.auth.id) {
		return { error: e.json(401, { message: 'Unauthorized' }) };
	}

	return { userId: String(e.auth.id) };
}

module.exports = {
	resolveHistoryUserId
};
