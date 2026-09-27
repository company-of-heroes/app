'use strict';

function notHiddenSessionClause(column) {
	return `NOT EXISTS (SELECT 1 FROM hidden_matches h WHERE h.sessionId = ${column})`;
}

/** Separators that the JS word-boundary hide path also treats as non-alphanumeric. */
const TITLE_SEPARATORS = [
	'-',
	'_',
	'/',
	'.',
	'(',
	')',
	':',
	',',
	';',
	'!',
	'?',
	'#',
	'@',
	'+',
	'=',
	"'",
	'"',
	'[',
	']',
	'{',
	'}',
	'|',
	'\\',
	'~',
	'*',
	'&',
	'%',
	'<',
	'>',
	'`',
	'^'
];

function normalizedTitleSql(expr) {
	let sql = `COALESCE(${expr}, '')`;
	for (let i = 0; i < TITLE_SEPARATORS.length; i++) {
		const sep = TITLE_SEPARATORS[i].replace(/'/g, "''");
		sql = `REPLACE(${sql}, '${sep}', ' ')`;
	}

	return `LOWER(' ' || ${sql} || ' ')`;
}

function likeNeedleSql(wordExpr) {
	const normalized = normalizedTitleSql(wordExpr);
	return `REPLACE(REPLACE(REPLACE(${normalized}, '\\', '\\\\'), '%', '\\%'), '_', '\\_')`;
}

function notHiddenTitleClause(descriptionExpr) {
	const title = normalizedTitleSql(descriptionExpr);
	const word = likeNeedleSql('k.word');
	return `NOT EXISTS (
		SELECT 1 FROM hidden_match_keywords k
		WHERE TRIM(k.word) != ''
		  AND ${title} LIKE '%' || ${word} || '%' ESCAPE '\\'
	)`;
}

function lobbyDescriptionSql(alias) {
	return `json_extract(${alias}.result, '$.description')`;
}

function notHiddenTitleBySessionClause(sessionColumn) {
	const title = normalizedTitleSql("json_extract(lh.result, '$.description')");
	const word = likeNeedleSql('k.word');
	return `NOT EXISTS (
		SELECT 1 FROM lobbies lh
		INNER JOIN hidden_match_keywords k ON TRIM(k.word) != ''
		WHERE lh.sessionId = ${sessionColumn}
		  AND ${title} LIKE '%' || ${word} || '%' ESCAPE '\\'
	)`;
}

function loadHiddenSessionIdMap() {
	const map = {};

	try {
		const rows = arrayOf(new DynamicModel({ sessionId: 0 }));
		$app.db().newQuery('SELECT sessionId FROM hidden_matches').all(rows);

		for (const row of rows) {
			const sessionId = Number(row.sessionId);
			if (Number.isInteger(sessionId) && sessionId > 0) {
				map[sessionId] = true;
			}
		}
	} catch (error) {
		console.warn('[hidden_matches] load failed', String(error?.message || error));
	}

	return map;
}

function loadHiddenKeywords() {
	const words = [];

	try {
		const rows = arrayOf(new DynamicModel({ word: '' }));
		$app.db().newQuery('SELECT word FROM hidden_match_keywords').all(rows);

		for (const row of rows) {
			const word = String(row.word || '').trim();
			if (word) {
				words.push(word);
			}
		}
	} catch (error) {
		console.warn('[hidden_match_keywords] load failed', String(error?.message || error));
	}

	return words;
}

function escapeRegExp(value) {
	return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function titleMatchesKeyword(title, words) {
	const text = String(title || '');
	if (!text || !words || words.length === 0) {
		return false;
	}

	for (const word of words) {
		const trimmed = String(word || '').trim();
		if (!trimmed) {
			continue;
		}

		const pattern = new RegExp(
			'(^|[^A-Za-z0-9])' + escapeRegExp(trimmed) + '([^A-Za-z0-9]|$)',
			'i'
		);
		if (pattern.test(text)) {
			return true;
		}
	}

	return false;
}

function lobbyResultDescription(record) {
	if (!record) {
		return '';
	}

	const result = record.get('result');
	if (!result) {
		return '';
	}

	if (typeof result === 'string') {
		try {
			const parsed = JSON.parse(result);
			return String(parsed?.description || '');
		} catch {
			return '';
		}
	}

	if (typeof result === 'object') {
		return String(result.description || '');
	}

	return '';
}

function isHiddenByTitle(record) {
	return titleMatchesKeyword(lobbyResultDescription(record), loadHiddenKeywords());
}

function filterHiddenMatchHistory(matches) {
	if (!matches || matches.length === 0) {
		return matches || [];
	}

	const hidden = loadHiddenSessionIdMap();
	const keywords = loadHiddenKeywords();
	if (Object.keys(hidden).length === 0 && keywords.length === 0) {
		return matches;
	}

	const visible = [];
	for (const match of matches) {
		if (hidden[Number(match.id)]) {
			continue;
		}
		if (titleMatchesKeyword(match.description, keywords)) {
			continue;
		}
		visible.push(match);
	}

	return visible;
}

function isHiddenSession(sessionId) {
	const id = Number(sessionId);
	if (!Number.isInteger(id) || id <= 0) {
		return false;
	}
	return !!loadHiddenSessionIdMap()[id];
}

function isHiddenLobby(record) {
	if (!record) {
		return false;
	}
	if (isHiddenSession(record.get('sessionId'))) {
		return true;
	}
	return isHiddenByTitle(record);
}

function normalizeKeyword(value) {
	return String(value || '')
		.trim()
		.replace(/\s+/g, ' ')
		.toLowerCase();
}

function invalidateMatchCountCache() {
	try {
		const snapshot = $app.findRecordById('match_filter_snapshots', 'community');
		snapshot.set('matchCount', 0);
		$app.save(snapshot);
	} catch (error) {
		console.warn('[hidden_matches] matchCount reset failed', String(error?.message || error));
	}
}

function isStaffAuth(auth) {
	if (!auth) {
		return false;
	}

	const role = auth.get('role');
	return role === 'admin' || role === 'moderator';
}

function assignAuthUser(record, field, auth) {
	if (!auth) return;
	try {
		if (auth.collection().name !== 'users') return;
	} catch {
		return;
	}
	record.set(field, auth.id);
}

function invalidateHiddenCaches() {
	invalidateMatchCountCache();
	try {
		require(`${__hooks}/lib/player-performance.js`).invalidateAllPerformanceCache();
	} catch (error) {
		console.warn('[hidden_matches] performance cache reset failed', String(error?.message || error));
	}
}

module.exports = {
	notHiddenSessionClause,
	notHiddenTitleClause,
	notHiddenTitleBySessionClause,
	lobbyDescriptionSql,
	loadHiddenSessionIdMap,
	loadHiddenKeywords,
	titleMatchesKeyword,
	lobbyResultDescription,
	filterHiddenMatchHistory,
	isHiddenSession,
	isHiddenLobby,
	isHiddenByTitle,
	normalizeKeyword,
	invalidateMatchCountCache,
	invalidateHiddenCaches,
	assignAuthUser,
	isStaffAuth
};
