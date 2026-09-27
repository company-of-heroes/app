'use strict';

const BATCH_SIZE = 25;
const JOB_ID = 'lobbies_dedupe';
const jobState = require(`${__hooks}/lib/job-state.js`);

/**
 * One partition per Relic session; rows without a real sessionId stay unique
 * by lobby id so skirmish/unknown matches are not collapsed together.
 */
const SESSION_PARTITION_SQL = `CASE
  WHEN COALESCE(l.sessionId, 0) > 0 THEN CAST(l.sessionId AS TEXT)
  ELSE l.id
END`;

function preferredOrderSql(alias) {
	return `CASE WHEN COALESCE(${alias}.needsResult, 1) = 0 THEN 0 ELSE 1 END ASC,
  CASE WHEN COALESCE(${alias}.hasReplay, 0) = 1 THEN 0 ELSE 1 END ASC,
  COALESCE(${alias}.likeCount, 0) DESC,
  ${alias}.createdAt DESC,
  ${alias}.id DESC`;
}

/** Preferred keeper: completed, then replay, then likes, then newest. */
const PREFERRED_ORDER_SQL = preferredOrderSql('l');

/** Keep one row per sessionId without a full-table window (so LIMIT can use createdAt). */
function isPreferredLobbyClause(alias) {
	const table = alias || 'l';
	return `(COALESCE(${table}.sessionId, 0) <= 0 OR ${table}.id = (
    SELECT o.id FROM lobbies o
    WHERE o.sessionId = ${table}.sessionId
    ORDER BY ${preferredOrderSql('o')}
    LIMIT 1
  ))`;
}

const DUPLICATE_SESSION_SQL = `SELECT sessionId
  FROM lobbies
  WHERE sessionId > 0
  GROUP BY sessionId
  HAVING COUNT(*) > 1
  LIMIT {:limit}`;

function isComplete() {
	return jobState.isComplete(JOB_ID);
}

function hasDuplicates() {
	const rows = arrayOf(new DynamicModel({ sessionId: 0 }));
	$app.db().newQuery(DUPLICATE_SESSION_SQL).bind({ limit: 1 }).all(rows);
	return rows.length > 0;
}

function reset() {
	jobState.reset(JOB_ID);
}

function compareLobbies(a, b) {
	const aDone = Number(a.needsResult) === 0 ? 0 : 1;
	const bDone = Number(b.needsResult) === 0 ? 0 : 1;
	if (aDone !== bDone) {
		return aDone - bDone;
	}
	const aReplay = Number(a.hasReplay) === 1 ? 0 : 1;
	const bReplay = Number(b.hasReplay) === 1 ? 0 : 1;
	if (aReplay !== bReplay) {
		return aReplay - bReplay;
	}
	const likeDiff = Number(b.likeCount) - Number(a.likeCount);
	if (likeDiff !== 0) {
		return likeDiff;
	}
	const aTime = String(a.createdAt || '');
	const bTime = String(b.createdAt || '');
	if (aTime !== bTime) {
		return aTime < bTime ? 1 : -1;
	}
	if (a.id === b.id) {
		return 0;
	}
	return a.id < b.id ? 1 : -1;
}

function deleteLobby(id) {
	try {
		$app.delete($app.findRecordById('lobbies', id));
		return true;
	} catch (error) {
		console.warn('[lobbies_dedupe] delete failed', id, String(error?.message || error));
		return false;
	}
}

function relationId(value) {
	if (!value) {
		return '';
	}

	if (typeof value === 'object') {
		return String(value.id || '');
	}

	return String(value);
}

/**
 * Copy replay / engagement fields from losers onto the keeper before delete,
 * so a completed row without a file does not erase a sibling's .rec.
 */
function mergeIntoKeeper(keeperId, loserIds) {
	if (!keeperId || !loserIds || loserIds.length === 0) {
		return;
	}

	let keeper;
	try {
		keeper = $app.findRecordById('lobbies', keeperId);
	} catch (error) {
		console.warn('[lobbies_dedupe] keeper missing', keeperId, String(error?.message || error));
		return;
	}

	let dirty = false;
	let downloadTotal = Number(keeper.get('downloadCount')) || 0;
	let likeCount = Number(keeper.get('likeCount')) || 0;
	let keeperHasReplay = !!keeper.get('hasReplay') || !!String(keeper.get('replay') || '').trim();
	let keeperMember = relationId(keeper.get('memberReplay'));

	for (let i = 0; i < loserIds.length; i++) {
		let loser;
		try {
			loser = $app.findRecordById('lobbies', loserIds[i]);
		} catch {
			continue;
		}

		downloadTotal += Number(loser.get('downloadCount')) || 0;
		const loserLikes = Number(loser.get('likeCount')) || 0;
		if (loserLikes > likeCount) {
			likeCount = loserLikes;
		}

		const loserReplayName = String(loser.get('replay') || '').trim();
		const loserHasReplay = !!loser.get('hasReplay') || !!loserReplayName;
		if (!keeperHasReplay && loserHasReplay && loserReplayName) {
			let tempPath = '';
			const fsys = $app.newFilesystem();
			try {
				tempPath = `${$os.tempDir()}/dedupe-replay-${Date.now()}-${String(Math.random()).slice(2, 10)}.rec`;
				const key = `${loser.baseFilesPath()}/${loserReplayName}`;
				const reader = fsys.getReader(key);
				try {
					const bytes = toBytes(reader);
					if (bytes && byteSize(bytes) >= 64) {
						$os.writeFile(tempPath, bytes, 0o644);
						keeper.set('replay', $filesystem.fileFromPath(tempPath));
						keeper.set('hasReplay', true);
						keeperHasReplay = true;
						dirty = true;
					}
				} finally {
					reader.close();
				}
			} catch (error) {
				console.warn(
					'[lobbies_dedupe] replay copy failed',
					loser.id,
					String(error?.message || error)
				);
			} finally {
				fsys.close();
				if (tempPath) {
					try {
						$os.remove(tempPath);
					} catch {
						// ignore
					}
				}
			}
		}

		const loserMember = relationId(loser.get('memberReplay'));
		if (!keeperMember && loserMember) {
			keeper.set('memberReplay', loserMember);
			keeperMember = loserMember;
			dirty = true;
		}

		const loserDuration = Number(loser.get('durationSeconds')) || 0;
		const keeperDuration = Number(keeper.get('durationSeconds')) || 0;
		if (loserDuration > keeperDuration) {
			keeper.set('durationSeconds', loserDuration);
			dirty = true;
		}
	}

	if (downloadTotal !== (Number(keeper.get('downloadCount')) || 0)) {
		keeper.set('downloadCount', downloadTotal);
		dirty = true;
	}

	if (likeCount !== (Number(keeper.get('likeCount')) || 0)) {
		keeper.set('likeCount', likeCount);
		dirty = true;
	}

	if (dirty) {
		try {
			$app.save(keeper);
		} catch (error) {
			console.warn('[lobbies_dedupe] merge save failed', keeperId, String(error?.message || error));
		}
	}
}

function byteSize(value) {
	if (!value) {
		return 0;
	}

	if (typeof value === 'string') {
		return value.length;
	}

	if (typeof value.byteLength === 'number') {
		return value.byteLength;
	}

	if (typeof value.length === 'number') {
		return value.length;
	}

	return 0;
}

function loadRowsForSessions(sessionIds) {
	if (sessionIds.length === 0) {
		return [];
	}
	const bindings = {};
	const placeholders = [];
	for (let i = 0; i < sessionIds.length; i++) {
		const key = `sid${i}`;
		bindings[key] = sessionIds[i];
		placeholders.push(`{:${key}}`);
	}
	const rows = arrayOf(
		new DynamicModel({
			id: '',
			sessionId: 0,
			needsResult: 0,
			hasReplay: 0,
			likeCount: 0,
			createdAt: ''
		})
	);
	$app
		.db()
		.newQuery(
			`SELECT id,
        sessionId,
        COALESCE(needsResult, 1) AS needsResult,
        COALESCE(hasReplay, 0) AS hasReplay,
        COALESCE(likeCount, 0) AS likeCount,
        CAST(createdAt AS TEXT) AS createdAt
      FROM lobbies
      WHERE sessionId IN (${placeholders.join(', ')})`
		)
		.bind(bindings)
		.all(rows);
	return rows;
}

function runBatch() {
	if (isComplete()) {
		return { groups: 0, deleted: 0, complete: true };
	}
	const groups = arrayOf(new DynamicModel({ sessionId: 0 }));
	$app.db().newQuery(DUPLICATE_SESSION_SQL).bind({ limit: BATCH_SIZE }).all(groups);
	if (groups.length === 0) {
		jobState.setComplete(JOB_ID, 1);
		return { groups: 0, deleted: 0, complete: true };
	}
	const sessionIds = groups.map((row) => Number(row.sessionId)).filter((id) => id > 0);
	const rows = loadRowsForSessions(sessionIds);
	const bySession = {};
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const sessionId = Number(row.sessionId);
		if (!bySession[sessionId]) {
			bySession[sessionId] = [];
		}
		bySession[sessionId].push(row);
	}
	let deleted = 0;
	const sessionKeys = Object.keys(bySession);
	for (let i = 0; i < sessionKeys.length; i++) {
		const copies = bySession[sessionKeys[i]];
		if (copies.length < 2) {
			continue;
		}
		copies.sort(compareLobbies);
		const keeperId = copies[0].id;
		const loserIds = [];
		for (let j = 1; j < copies.length; j++) {
			loserIds.push(copies[j].id);
		}
		mergeIntoKeeper(keeperId, loserIds);
		for (let j = 0; j < loserIds.length; j++) {
			if (deleteLobby(loserIds[j])) {
				deleted += 1;
			}
		}
	}
	const complete = groups.length < BATCH_SIZE;
	if (complete) {
		jobState.setComplete(JOB_ID, 1);
	} else {
		jobState.setPage(JOB_ID, 1);
	}
	return { groups: groups.length, deleted, complete };
}

function assertUniqueSession(record) {
	const sessionId = Number(record.get('sessionId'));
	if (!Number.isFinite(sessionId) || sessionId <= 0) {
		return;
	}
	const existing = arrayOf(new DynamicModel({ id: '' }));
	$app
		.db()
		.newQuery(
			`SELECT id FROM lobbies
       WHERE sessionId = {:sessionId} AND id != {:id}
       LIMIT 1`
		)
		.bind({ sessionId, id: record.id || '' })
		.all(existing);
	if (existing.length > 0) {
		throw new BadRequestError('Duplicate session');
	}
}

module.exports = {
	BATCH_SIZE,
	SESSION_PARTITION_SQL,
	PREFERRED_ORDER_SQL,
	isPreferredLobbyClause,
	isComplete,
	hasDuplicates,
	reset,
	runBatch,
	assertUniqueSession
};
