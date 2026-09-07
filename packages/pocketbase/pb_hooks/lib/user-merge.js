'use strict';

const ROLE_RANK = { admin: 2, moderator: 1 };
const locks = {};

function isServiceRequest(e) {
	const token = $os.getenv('SMURF_SERVICE_TOKEN') || '';
	if (!token) {
		return false;
	}
	const auth = e.request.header.get('Authorization') || '';
	return auth === `Bearer ${token}`;
}

function hasCollection(name) {
	try {
		$app.findCollectionByNameOrId(name);
		return true;
	} catch {
		return false;
	}
}

function exec(sql, bindings) {
	$app.db().newQuery(sql).bind(bindings).execute();
}

function tryExec(sql, bindings) {
	try {
		exec(sql, bindings);
		return true;
	} catch (error) {
		console.warn('[user_merge] sql failed', String(error?.message || error));
		return false;
	}
}

function parseJsonValue(raw) {
	if (raw == null || raw === '' || raw === '[]' || raw === 'null' || raw === '{}') {
		return null;
	}
	if (typeof raw === 'object' && !Array.isArray(raw)) {
		return raw;
	}
	if (Array.isArray(raw)) {
		if (raw.length > 0 && typeof raw[0] === 'number') {
			let text = '';
			for (let i = 0; i < raw.length; i++) {
				text += String.fromCharCode(raw[i]);
			}
			return parseJsonValue(text);
		}
		return raw;
	}
	if (typeof raw === 'string') {
		try {
			return JSON.parse(raw);
		} catch {
			return null;
		}
	}
	return null;
}

function uniqStrings(values) {
	const seen = {};
	const result = [];
	for (let i = 0; i < values.length; i++) {
		const id = String(values[i] || '').trim();
		if (!id || seen[id]) continue;
		seen[id] = true;
		result.push(id);
	}
	return result;
}

function parseSteamIds(raw) {
	const parsed = parseJsonValue(raw);
	if (Array.isArray(parsed)) {
		return uniqStrings(parsed);
	}
	if (parsed && typeof parsed === 'object') {
		return uniqStrings(
			Object.keys(parsed)
				.filter((key) => String(Number(key)) === key)
				.sort((a, b) => Number(a) - Number(b))
				.map((key) => parsed[key])
		);
	}
	return [];
}

function loadSteamIdsForUser(userId) {
	if (!userId) return [];
	try {
		const row = new DynamicModel({ steamIds: '' });
		$app
			.db()
			.newQuery('SELECT CAST(steamIds AS TEXT) AS steamIds FROM users WHERE id = {:id}')
			.bind({ id: userId })
			.one(row);
		return parseSteamIds(row.steamIds);
	} catch {
		return [];
	}
}

function parseMeta(raw) {
	const parsed = parseJsonValue(raw);
	if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
		return parsed;
	}
	return {};
}

function versionOf(record) {
	return String(parseMeta(record.get('meta')).version || '0');
}

function versionParts(value) {
	const core = String(value || '0').split(/[-+]/)[0];
	return core.split('.').map((part) => parseInt(part, 10) || 0);
}

function compareVersions(a, b) {
	const pa = versionParts(a);
	const pb = versionParts(b);
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const d = (pa[i] || 0) - (pb[i] || 0);
		if (d) return d;
	}
	return 0;
}

function dateMs(value) {
	if (!value) return 0;
	const t = new Date(value).getTime();
	return isNaN(t) ? 0 : t;
}

function roleRank(role) {
	return ROLE_RANK[String(role || '')] || 0;
}

function findUserIdsBySteamIds(steamIds) {
	if (!steamIds.length) return [];
	const bindings = {};
	const placeholders = [];
	for (let i = 0; i < steamIds.length; i++) {
		const key = 'sid' + i;
		bindings[key] = steamIds[i];
		placeholders.push('{:' + key + '}');
	}
	try {
		const rows = arrayOf(new DynamicModel({ id: '' }));
		$app
			.db()
			.newQuery(
				`SELECT DISTINCT u.id AS id
				 FROM users u, json_each(
					 CASE WHEN json_valid(u.steamIds) THEN u.steamIds ELSE '[]' END
				 ) AS s
				 WHERE CAST(s.value AS TEXT) IN (${placeholders.join(', ')})`
			)
			.bind(bindings)
			.all(rows);
		return rows.map((row) => String(row.id)).filter(Boolean);
	} catch (error) {
		console.warn('[user_merge] find users by steam', String(error?.message || error));
		return [];
	}
}

function expandGroup(seedIds) {
	const group = {};
	for (let i = 0; i < seedIds.length; i++) {
		if (seedIds[i]) group[seedIds[i]] = true;
	}
	let changed = true;
	while (changed) {
		changed = false;
		const steamSeen = {};
		const steamIds = [];
		const ids = Object.keys(group);
		for (let i = 0; i < ids.length; i++) {
			const userSteam = loadSteamIdsForUser(ids[i]);
			for (let j = 0; j < userSteam.length; j++) {
				if (steamSeen[userSteam[j]]) continue;
				steamSeen[userSteam[j]] = true;
				steamIds.push(userSteam[j]);
			}
		}
		if (!steamIds.length) break;
		const found = findUserIdsBySteamIds(steamIds);
		for (let i = 0; i < found.length; i++) {
			if (!group[found[i]]) {
				group[found[i]] = true;
				changed = true;
			}
		}
	}
	return Object.keys(group);
}

function loadUserRecords(ids) {
	const records = [];
	for (let i = 0; i < ids.length; i++) {
		try {
			records.push($app.findRecordById('users', ids[i]));
		} catch (error) {
			console.warn('[user_merge] missing user', ids[i], String(error?.message || error));
		}
	}
	return records;
}

function sortByVersion(records) {
	return records.slice().sort((a, b) => {
		const version = compareVersions(versionOf(b), versionOf(a));
		if (version) return version;
		const login = dateMs(b.get('lastLogin')) - dateMs(a.get('lastLogin'));
		if (login) return login;
		return dateMs(b.get('created')) - dateMs(a.get('created'));
	});
}

function pickKeeper(records, preferKeepId) {
	if (preferKeepId) {
		for (let i = 0; i < records.length; i++) {
			if (records[i].id === preferKeepId) return records[i];
		}
	}
	return sortByVersion(records)[0];
}

function dropUniqueConflicts(collection, field, loserId, keeperId, peerField) {
	if (!hasCollection(collection)) return;
	tryExec(
		`DELETE FROM ${collection}
		 WHERE ${field} = {:loser}
		 AND ${peerField} IN (
			SELECT ${peerField} FROM (
				SELECT ${peerField} FROM ${collection} WHERE ${field} = {:keeper}
			)
		 )`,
		{ loser: loserId, keeper: keeperId }
	);
}

function reassignField(collection, field, loserId, keeperId) {
	if (!hasCollection(collection)) return;
	tryExec(`UPDATE ${collection} SET ${field} = {:keeper} WHERE ${field} = {:loser}`, {
		loser: loserId,
		keeper: keeperId
	});
}

function rewriteNotificationRecipients(loserId, keeperId) {
	if (!hasCollection('notifications')) return;
	tryExec(
		`UPDATE notifications
		 SET recipients = (
			SELECT json_group_array(DISTINCT CASE
				WHEN CAST(s.value AS TEXT) = {:loser} THEN {:keeper}
				ELSE CAST(s.value AS TEXT)
			END)
			FROM json_each(
				CASE WHEN json_valid(notifications.recipients) THEN notifications.recipients ELSE '[]' END
			) AS s
		 )
		 WHERE id IN (
			SELECT n.id FROM notifications n, json_each(
				CASE WHEN json_valid(n.recipients) THEN n.recipients ELSE '[]' END
			) AS s
			WHERE CAST(s.value AS TEXT) = {:loser}
		 )`,
		{ loser: loserId, keeper: keeperId }
	);
}

function dropReportConflicts(loserId, keeperId) {
	if (!hasCollection('anti_cheat_reports')) return;
	tryExec(
		`DELETE FROM anti_cheat_reports
		 WHERE reporter = {:loser}
		 AND EXISTS (
			SELECT 1 FROM anti_cheat_reports k
			WHERE k.reporter = {:keeper}
			  AND k.session_id = anti_cheat_reports.session_id
			  AND k.accused = CASE
				WHEN anti_cheat_reports.accused = {:loser} THEN {:keeper}
				ELSE anti_cheat_reports.accused
			  END
		 )`,
		{ loser: loserId, keeper: keeperId }
	);
	tryExec(`UPDATE anti_cheat_reports SET reporter = {:keeper} WHERE reporter = {:loser}`, {
		loser: loserId,
		keeper: keeperId
	});
	tryExec(
		`DELETE FROM anti_cheat_reports
		 WHERE accused = {:loser}
		 AND EXISTS (
			SELECT 1 FROM anti_cheat_reports k
			WHERE k.accused = {:keeper}
			  AND k.reporter = anti_cheat_reports.reporter
			  AND k.session_id = anti_cheat_reports.session_id
		 )`,
		{ loser: loserId, keeper: keeperId }
	);
	tryExec(`UPDATE anti_cheat_reports SET accused = {:keeper} WHERE accused = {:loser}`, {
		loser: loserId,
		keeper: keeperId
	});
}

function deleteLoserLiveAndOverlay(loserId) {
	if (hasCollection('lobbies_live')) {
		tryExec('DELETE FROM lobbies_live WHERE user = {:loser}', { loser: loserId });
	}
}

function reassignLoser(loserId, keeperId) {
	dropUniqueConflicts('lobby_likes', 'user', loserId, keeperId, 'lobby');
	reassignField('lobby_likes', 'user', loserId, keeperId);
	dropUniqueConflicts('lobby_downloads', 'user', loserId, keeperId, 'lobby');
	reassignField('lobby_downloads', 'user', loserId, keeperId);
	dropUniqueConflicts('lobby_comment_likes', 'user', loserId, keeperId, 'comment');
	reassignField('lobby_comment_likes', 'user', loserId, keeperId);
	dropUniqueConflicts('notification_reads', 'user', loserId, keeperId, 'notification');
	reassignField('notification_reads', 'user', loserId, keeperId);
	reassignField('lobby_comments', 'user', loserId, keeperId);
	reassignField('lobbies', 'user', loserId, keeperId);
	reassignField('lobby_player_index', 'lobby_user', loserId, keeperId);
	reassignField('replays', 'createdBy', loserId, keeperId);
	reassignField('anti_cheat_captures', 'user', loserId, keeperId);
	reassignField('anti_cheat_process_hits', 'user', loserId, keeperId);
	reassignField('anti_cheat_module_hits', 'user', loserId, keeperId);
	reassignField('anti_cheat_cheaters', 'user', loserId, keeperId);
	reassignField('anti_cheat_cheaters', 'labeled_by', loserId, keeperId);
	reassignField('notifications', 'createdBy', loserId, keeperId);
	rewriteNotificationRecipients(loserId, keeperId);
	dropReportConflicts(loserId, keeperId);
	deleteLoserLiveAndOverlay(loserId);
}

function deleteDuplicateRecords(collection, ids) {
	if (!hasCollection(collection) || !ids.length) return 0;
	let removed = 0;
	for (let i = 0; i < ids.length; i++) {
		try {
			$app.delete($app.findRecordById(collection, ids[i]));
			removed += 1;
		} catch (error) {
			console.warn('[user_merge] delete', collection, ids[i], String(error?.message || error));
		}
	}
	return removed;
}

function dedupeLobbiesForUser(userId) {
	if (!hasCollection('lobbies')) return 0;
	const rows = arrayOf(new DynamicModel({ id: '', sessionId: 0, createdAt: '' }));
	try {
		$app
			.db()
			.newQuery(
				`SELECT id, sessionId, CAST(createdAt AS TEXT) AS createdAt
				 FROM lobbies WHERE user = {:user}`
			)
			.bind({ user: userId })
			.all(rows);
	} catch (error) {
		console.warn('[user_merge] list lobbies', String(error?.message || error));
		return 0;
	}
	const keep = {};
	const drop = [];
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const key = String(row.sessionId);
		const prev = keep[key];
		if (!prev) {
			keep[key] = row;
			continue;
		}
		if (dateMs(row.createdAt) > dateMs(prev.createdAt)) {
			drop.push(prev.id);
			keep[key] = row;
		} else {
			drop.push(row.id);
		}
	}
	return deleteDuplicateRecords('lobbies', drop);
}

function dedupeReplaysForUser(userId) {
	if (!hasCollection('replays')) return 0;
	const rows = arrayOf(
		new DynamicModel({ id: '', title: '', filename: '', gameDate: '', createdAt: '' })
	);
	try {
		$app
			.db()
			.newQuery(
				`SELECT id,
					COALESCE(title, '') AS title,
					COALESCE(filename, '') AS filename,
					COALESCE(CAST(gameDate AS TEXT), '') AS gameDate,
					CAST(createdAt AS TEXT) AS createdAt
				 FROM replays WHERE createdBy = {:user}`
			)
			.bind({ user: userId })
			.all(rows);
	} catch (error) {
		console.warn('[user_merge] list replays', String(error?.message || error));
		return 0;
	}
	const keep = {};
	const drop = [];
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const key = `${row.title}||${row.filename}||${row.gameDate}`;
		const prev = keep[key];
		if (!prev) {
			keep[key] = row;
			continue;
		}
		if (dateMs(row.createdAt) > dateMs(prev.createdAt)) {
			drop.push(prev.id);
			keep[key] = row;
		} else {
			drop.push(row.id);
		}
	}
	return deleteDuplicateRecords('replays', drop);
}

function applyProfile(keeper, records) {
	const ranked = sortByVersion(records);
	const steamSeen = {};
	const steamIds = [];
	let bestRole = keeper.get('role') || '';
	let name = String(keeper.get('name') || '').trim();
	let lastLogin = keeper.get('lastLogin');
	for (let i = 0; i < records.length; i++) {
		const ids = parseSteamIds(records[i].get('steamIds'));
		for (let j = 0; j < ids.length; j++) {
			if (steamSeen[ids[j]]) continue;
			steamSeen[ids[j]] = true;
			steamIds.push(ids[j]);
		}
		if (roleRank(records[i].get('role')) > roleRank(bestRole)) {
			bestRole = records[i].get('role');
		}
		if (dateMs(records[i].get('lastLogin')) > dateMs(lastLogin)) {
			lastLogin = records[i].get('lastLogin');
		}
	}
	if (!name) {
		for (let i = 0; i < ranked.length; i++) {
			const candidate = String(ranked[i].get('name') || '').trim();
			if (candidate) {
				name = candidate;
				break;
			}
		}
	}
	keeper.set('steamIds', steamIds);
	if (name) keeper.set('name', name);
	if (bestRole) keeper.set('role', bestRole);
	if (lastLogin) keeper.set('lastLogin', lastLogin);
}

function steamIdsChanged(record) {
	try {
		const original = record.original();
		const next = parseSteamIds(record.get('steamIds'));
		const prev = parseSteamIds(original.get('steamIds'));
		if (next.length !== prev.length) return true;
		const seen = {};
		for (let i = 0; i < prev.length; i++) {
			seen[prev[i]] = true;
		}
		for (let i = 0; i < next.length; i++) {
			if (!seen[next[i]]) return true;
		}
		return false;
	} catch {
		return parseSteamIds(record.get('steamIds')).length > 0;
	}
}

function mergeGroup(ids, preferKeepId) {
	if (ids.length < 2) {
		return { merged: false, reason: 'single' };
	}
	for (let i = 0; i < ids.length; i++) {
		if (locks[ids[i]]) {
			return { merged: false, reason: 'locked' };
		}
	}
	for (let i = 0; i < ids.length; i++) {
		locks[ids[i]] = true;
	}
	try {
		const records = loadUserRecords(ids);
		if (records.length < 2) {
			return { merged: false, reason: 'missing' };
		}
		const keeper = pickKeeper(records, preferKeepId);
		const losers = records.filter((record) => record.id !== keeper.id);
		for (let i = 0; i < losers.length; i++) {
			reassignLoser(losers[i].id, keeper.id);
		}
		applyProfile(keeper, records);
		try {
			$app.save(keeper);
		} catch (error) {
			console.warn('[user_merge] save keeper', keeper.id, String(error?.message || error));
			return { merged: false, reason: 'save', keeperId: keeper.id };
		}
		const lobbiesRemoved = dedupeLobbiesForUser(keeper.id);
		const replaysRemoved = dedupeReplaysForUser(keeper.id);
		const deleted = [];
		for (let i = 0; i < losers.length; i++) {
			try {
				$app.delete(losers[i]);
				deleted.push(losers[i].id);
			} catch (error) {
				console.warn('[user_merge] delete user', losers[i].id, String(error?.message || error));
			}
		}
		console.log(
			`[user_merge] merged ${deleted.length} account(s) into ${keeper.id} lobbiesDedupe=${lobbiesRemoved} replaysDedupe=${replaysRemoved}`
		);
		try {
			require(`${__hooks}/lib/anti-cheat-cheaters.js`).syncForUser(keeper.id);
		} catch (error) {
			console.warn('[user_merge] cheater sync', String(error?.message || error));
		}
		return {
			merged: deleted.length > 0,
			keeperId: keeper.id,
			loserIds: deleted,
			lobbiesRemoved,
			replaysRemoved
		};
	} finally {
		for (let i = 0; i < ids.length; i++) {
			delete locks[ids[i]];
		}
	}
}

function mergeFromUser(userId, preferKeepId) {
	if (!userId) {
		return { merged: false, reason: 'empty' };
	}
	if (locks[userId]) {
		return { merged: false, reason: 'locked' };
	}
	const steamIds = loadSteamIdsForUser(userId);
	if (!steamIds.length) {
		return { merged: false, reason: 'no-steam' };
	}
	const matches = findUserIdsBySteamIds(steamIds);
	if (matches.length < 2) {
		return { merged: false, reason: 'single' };
	}
	const group = expandGroup(matches);
	return mergeGroup(group, preferKeepId || userId);
}

function findOneDuplicateSteamId() {
	try {
		const row = new DynamicModel({ steamId: '' });
		$app
			.db()
			.newQuery(
				`SELECT CAST(s.value AS TEXT) AS steamId
				 FROM users u, json_each(
					 CASE WHEN json_valid(u.steamIds) THEN u.steamIds ELSE '[]' END
				 ) AS s
				 WHERE CAST(s.value AS TEXT) != ''
				 GROUP BY CAST(s.value AS TEXT)
				 HAVING COUNT(DISTINCT u.id) > 1
				 LIMIT 1`
			)
			.one(row);
		return String(row.steamId || '').trim();
	} catch {
		return '';
	}
}

function runOnce() {
	const steamId = findOneDuplicateSteamId();
	if (!steamId) {
		return { merged: false, remaining: false };
	}
	const matches = findUserIdsBySteamIds([steamId]);
	const group = expandGroup(matches);
	const result = mergeGroup(group, null);
	return Object.assign({ remaining: Boolean(findOneDuplicateSteamId()) }, result);
}

function runBatch(maxGroups) {
	const limit = Math.max(1, Number(maxGroups) || 1);
	const groups = [];
	for (let i = 0; i < limit; i++) {
		const result = runOnce();
		if (!result.merged) {
			return { groups, remaining: Boolean(result.remaining) };
		}
		groups.push(result);
	}
	return { groups, remaining: Boolean(findOneDuplicateSteamId()) };
}

module.exports = {
	isServiceRequest,
	steamIdsChanged,
	loadSteamIdsForUser,
	mergeFromUser,
	runOnce,
	runBatch
};
