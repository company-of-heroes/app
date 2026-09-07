'use strict';

function parseLobbyPlayersField(raw) {
	if (Array.isArray(raw)) {
		return raw;
	}

	if (typeof raw !== 'string' || raw.length === 0) {
		return [];
	}

	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function summarizePlayersFromLobbyField(lobbyPlayersRaw) {
	const players = [];

	for (const player of lobbyPlayersRaw) {
		const profileId =
			player?.profile_id != null
				? Number(player.profile_id)
				: player?.profile?.profile_id != null
					? Number(player.profile.profile_id)
					: null;

		if (profileId == null) {
			continue;
		}

		players.push({
			playerId: player?.playerId != null ? Number(player.playerId) : null,
			steamId: player?.steamId ?? null,
			race: player?.race != null ? Number(player.race) : null,
			profile: {
				profile_id: profileId,
				alias: player?.alias ?? player?.profile?.alias ?? ''
			}
		});
	}

	return players;
}

function loadPlayerAliasMap(scope, userId) {
	try {
		const snapshotId = scope === 'community' ? 'community' : `user-v2:${userId}`;
		const snapshot = $app.findRecordById('match_filter_snapshots', snapshotId);
		const snapshotPlayers = snapshot.get('players') || [];
		const aliasMap = {};

		for (const player of snapshotPlayers) {
			if (player?.profile_id != null) {
				aliasMap[Number(player.profile_id)] = player.alias ?? '';
			}
		}

		return aliasMap;
	} catch {
		return {};
	}
}

function hasTeamData(players) {
	for (const player of players) {
		if (player.race != null) {
			return true;
		}
	}

	return false;
}

function parseResultField(raw) {
	if (!raw) {
		return null;
	}

	if (typeof raw === 'string' && raw.length > 0) {
		try {
			return JSON.parse(raw);
		} catch {
			return null;
		}
	}

	if (typeof raw === 'object') {
		return raw;
	}

	return null;
}

function summarizePlayersFromResult(result) {
	if (!result || !Array.isArray(result.players)) {
		return [];
	}

	const players = [];

	for (const player of result.players) {
		const profileId = player?.profile_id != null ? Number(player.profile_id) : null;

		if (profileId == null) {
			continue;
		}

		let steamId = player?.steamId ?? null;

		if (!steamId && typeof player?.name === 'string' && player.name.startsWith('/steam/')) {
			steamId = player.name.slice('/steam/'.length);
		}

		players.push({
			playerId: profileId,
			steamId,
			race: player?.race_id != null ? Number(player.race_id) : null,
			profile: {
				profile_id: profileId,
				alias: player?.alias ?? ''
			}
		});
	}

	return players;
}

function summarizePlayersFromCsv(csv, aliasMap) {
	if (typeof csv !== 'string' || csv.length === 0) {
		return [];
	}

	const players = [];

	for (const part of csv.split(',')) {
		if (!part) {
			continue;
		}

		const profileId = Number(part);

		if (Number.isNaN(profileId)) {
			continue;
		}

		players.push({
			playerId: null,
			steamId: null,
			race: null,
			profile: {
				profile_id: profileId,
				alias: aliasMap[profileId] ?? ''
			}
		});
	}

	return players;
}

function loadPlayersByLobbyIds(lobbyIds, aliasMap) {
	if (!lobbyIds || lobbyIds.length === 0) {
		return {};
	}

	const bindings = {};
	const lobbyClauses = [];

	for (let i = 0; i < lobbyIds.length; i++) {
		const key = `lobbyId${i}`;
		bindings[key] = lobbyIds[i];
		lobbyClauses.push(`{:${key}}`);
	}

	const rows = arrayOf(new DynamicModel({ lobby: '', profile_id: 0 }));

	$app
		.db()
		.newQuery(
			`SELECT lobby, profile_id
       FROM lobby_player_index
       WHERE lobby IN (${lobbyClauses.join(', ')})`
		)
		.bind(bindings)
		.all(rows);

	const playersByLobby = {};

	for (const row of rows) {
		if (!playersByLobby[row.lobby]) {
			playersByLobby[row.lobby] = [];
		}

		const profileId = Number(row.profile_id);

		playersByLobby[row.lobby].push({
			playerId: null,
			steamId: null,
			race: null,
			profile: {
				profile_id: profileId,
				alias: aliasMap[profileId] ?? ''
			}
		});
	}

	return playersByLobby;
}

function resolvePlayersForRow(row, aliasMap, playersByLobby) {
	const fromLobbyField = summarizePlayersFromLobbyField(parseLobbyPlayersField(row.lobbyPlayers));

	if (fromLobbyField.length > 0 && hasTeamData(fromLobbyField)) {
		return fromLobbyField;
	}

	const fromResult = summarizePlayersFromResult(parseResultField(row.result));

	if (fromResult.length > 0) {
		return fromResult;
	}

	if (fromLobbyField.length > 0) {
		return fromLobbyField;
	}

	const fromCsv = summarizePlayersFromCsv(row.playerProfileIdsCsv, aliasMap);

	if (fromCsv.length > 0) {
		return fromCsv;
	}

	return playersByLobby[row.id] || [];
}

function countFilteredMatches(hasPlayerFilter, numericPlayerIds, whereClause, bindings, joinExtra) {
	let countSql;
	const extra = joinExtra ? ` ${joinExtra}` : '';

	if (hasPlayerFilter) {
		countSql = `SELECT COUNT(*) AS total
       FROM lobby_player_index i
       INNER JOIN lobbies l ON l.id = i.lobby
       WHERE i.profile_id IN (${numericPlayerIds.join(', ')})
         ${extra}
         AND ${whereClause}`;
	} else {
		countSql = `SELECT COUNT(*) AS total FROM lobbies l WHERE ${whereClause}`;
	}

	const countRow = new DynamicModel({ total: 0 });
	$app.db().newQuery(countSql).bind(bindings).one(countRow);

	return Number(countRow.total) || 0;
}

function invalidateCommunityMatchCount() {
	try {
		const snapshot = $app.findRecordById('match_filter_snapshots', 'community');
		snapshot.set('matchCount', 0);
		$app.save(snapshot);
	} catch (error) {
		console.warn(
			'[match-history] matchCount invalidate failed',
			String(error?.message || error)
		);
	}
}

function readCommunityMatchCount() {
	try {
		const row = new DynamicModel({ matchCount: 0 });
		$app.db().newQuery("SELECT matchCount FROM match_filter_snapshots WHERE id = 'community'").one(row);
		const value = Number(row.matchCount);
		return Number.isFinite(value) && value > 0 ? value : null;
	} catch {
		return null;
	}
}

function saveCommunityMatchCount(totalItems) {
	try {
		$app
			.db()
			.newQuery(
				"UPDATE match_filter_snapshots SET matchCount = {:total} WHERE id = 'community'"
			)
			.bind({ total: Number(totalItems) || 0 })
			.execute();
	} catch (error) {
		console.warn('[match-history] matchCount cache write failed', String(error?.message || error));
	}
}

function ensureCommunityReplayIndex() {
	try {
		// Never DROP this index — recreating it on the large lobbies table blocks serve.
		// CREATE INDEX IF NOT EXISTS is also expensive when missing; callers must run
		// this off the onServe critical path (cron / deferred).
		$app
			.db()
			.newQuery(
				'CREATE INDEX IF NOT EXISTS `idx_lobbies_community_replays` ON `lobbies` (`createdAt`, `title`, `sessionId`) WHERE `hasReplay` = 1 AND `needsResult` = 0'
			)
			.execute();
	} catch (error) {
		console.warn('[match-history] community index', String(error?.message || error));
	}
}

const COMPARE_OPS = {
	gt: '>',
	gte: '>=',
	lt: '<',
	lte: '<='
};

function parseCompareOp(raw) {
	return COMPARE_OPS[raw] ? raw : '';
}

/** `Number('')` is 0, so missing query params must not count as a real filter. */
function parseOptionalNumber(raw) {
	if (raw == null || raw === '') {
		return NaN;
	}
	const value = Number(raw);
	return Number.isFinite(value) ? value : NaN;
}

function compareClause(column, op, bindingKey, value, bindings) {
	const sqlOp = COMPARE_OPS[op] || '>=';
	bindings[bindingKey] = value;
	return `${column} IS NOT NULL AND ${column} ${sqlOp} {:${bindingKey}}`;
}

const RESULT_PLAYERS_JSON = `CASE
          WHEN l.result IS NOT NULL AND l.result != ''
               AND json_valid(l.result)
               AND json_type(json_extract(l.result, '$.players')) = 'array'
          THEN json_extract(l.result, '$.players')
          ELSE '[]'
        END`;

/**
 * Player ELO for filters. `lobby_player_index.elo` is 0 until the catalog
 * backfill catches up, so fall back to Relic oldrating/newrating on the
 * same profile in `lobbies.result`.
 */
function playerEloExpr() {
	return `COALESCE(
    NULLIF(i.elo, 0),
    (
      SELECT COALESCE(
        NULLIF(CAST(json_extract(p.value, '$.oldrating') AS REAL), 0),
        NULLIF(CAST(json_extract(p.value, '$.newrating') AS REAL), 0)
      )
      FROM json_each(${RESULT_PLAYERS_JSON}) p
      WHERE CAST(json_extract(p.value, '$.profile_id') AS INTEGER) = i.profile_id
      LIMIT 1
    )
  )`;
}

function comparePlayerEloClause(op, value, bindings) {
	const sqlOp = COMPARE_OPS[op] || '>=';
	bindings.eloValue = value;
	const elo = playerEloExpr();
	return `${elo} IS NOT NULL AND ${elo} ${sqlOp} {:eloValue}`;
}

const LOBBY_PLAYERS_JSON = `CASE
          WHEN l.players IS NOT NULL AND l.players != '' AND l.players != '[]'
               AND json_valid(l.players)
          THEN l.players
          ELSE '[]'
        END`;

/**
 * 1-based lobby position. `lobby_player_index.slot` is 0 until backfill;
 * game `players.slot` is 0-based so JSON fallback adds 1.
 */
function playerSlotExpr() {
	const fromPlayers = `(
      SELECT CAST(json_extract(p.value, '$.slot') AS INTEGER) + 1
      FROM json_each(${LOBBY_PLAYERS_JSON}) p
      WHERE CAST(COALESCE(
        json_extract(p.value, '$.playerId'),
        json_extract(p.value, '$.profile.profile_id'),
        json_extract(p.value, '$.profile_id')
      ) AS INTEGER) = i.profile_id
        AND json_extract(p.value, '$.slot') IS NOT NULL
      LIMIT 1
    )`;
	try {
		if ($app.findCollectionByNameOrId('lobby_player_index').fields.getByName('slot')) {
			return `COALESCE(NULLIF(i.slot, 0), ${fromPlayers})`;
		}
	} catch {
		// field not migrated yet
	}
	return fromPlayers;
}

function buildProFilterClause() {
	return `l.isRanked = 1
    AND l.avgElo IS NOT NULL
    AND (
      CASE
        WHEN CAST(json_extract(l.result, '$.matchtype_id') AS INTEGER) = 1 THEN l.avgElo >= 1800
        WHEN CAST(json_extract(l.result, '$.matchtype_id') AS INTEGER) IN (2, 3, 4, 5, 6, 7)
          THEN l.avgElo >= 1850
        WHEN json_array_length(json_extract(l.result, '$.players')) = 2 THEN l.avgElo >= 1800
        WHEN json_array_length(json_extract(l.result, '$.players')) IN (4, 6, 8) THEN l.avgElo >= 1850
        ELSE 0
      END
    )`;
}

/**
 * Conditions on lobby_player_index alias `i` for faction + position + player-ELO
 * composition. Returns null when the filter should not apply.
 */
function buildIndexPlayerConditions(
	{ races = [], slots = [], eloOp, eloValue, steamIds = [], profileIds = [] } = {},
	bindings,
	{ allowAnyPlayer = false } = {}
) {
	const hasRace = Array.isArray(races) && races.length > 0;
	const hasSlot = Array.isArray(slots) && slots.length > 0;
	const hasElo = eloOp && Number.isFinite(eloValue);
	if (!hasRace && !hasElo && !hasSlot) {
		return null;
	}

	const hasIdentity =
		(steamIds && steamIds.length > 0) || (profileIds && profileIds.length > 0);
	if (!hasIdentity && !allowAnyPlayer) {
		return null;
	}

	const parts = [];

	if (hasRace) {
		const racePlaceholders = [];
		for (let i = 0; i < races.length; i++) {
			const key = `idxRace${i}`;
			bindings[key] = races[i];
			racePlaceholders.push(`{:${key}}`);
		}
		parts.push(`i.race_id IN (${racePlaceholders.join(', ')})`);
	}

	if (hasSlot) {
		const slotPlaceholders = [];
		for (let i = 0; i < slots.length; i++) {
			const key = `idxSlot${i}`;
			bindings[key] = slots[i];
			slotPlaceholders.push(`{:${key}}`);
		}
		parts.push(`${playerSlotExpr()} IN (${slotPlaceholders.join(', ')})`);
	}

	if (hasElo) {
		parts.push(comparePlayerEloClause(eloOp, eloValue, bindings));
	}

	if (hasIdentity) {
		const identity = [];
		for (let i = 0; i < steamIds.length; i++) {
			const key = `idxSteam${i}`;
			bindings[key] = steamIds[i];
			identity.push(`i.steam_id = {:${key}}`);
		}
		for (let i = 0; i < profileIds.length; i++) {
			const key = `idxPid${i}`;
			bindings[key] = profileIds[i];
			identity.push(`i.profile_id = {:${key}}`);
		}
		parts.push(`(${identity.join(' OR ')})`);
	}

	return parts.join(' AND ');
}

function buildSortClause(sort, sortDir) {
	const columns = {
		createdAt: 'l.createdAt',
		likeCount: 'l.likeCount',
		downloadCount: 'l.downloadCount',
		commentCount: 'l.commentCount'
	};
	const column = columns[sort] || 'l.createdAt';
	const direction = sortDir === 'asc' ? 'ASC' : 'DESC';
	if (column === 'l.createdAt') {
		return `l.createdAt ${direction}`;
	}
	return `${column} ${direction}, l.createdAt DESC`;
}

/**
 * Builds an EXISTS clause matching selected races via lobbyPlayers.race or
 * result.players.race_id. Mutates bindings.
 *
 * When steamIds/profileIds are provided, only those subjects count.
 * When allowAnyPlayer is true and no subjects are given, any participant
 * with the selected race(s) matches (community "faction only" filter).
 * Returns null when the filter should not apply.
 */
function buildRaceFilterClause(
	races,
	{ steamIds = [], profileIds = [] } = {},
	bindings,
	{ allowAnyPlayer = false } = {}
) {
	if (!races || races.length === 0) {
		return null;
	}

	const hasIdentity =
		(steamIds && steamIds.length > 0) || (profileIds && profileIds.length > 0);

	if (!hasIdentity && !allowAnyPlayer) {
		return null;
	}

	const racePlaceholders = [];

	for (let i = 0; i < races.length; i++) {
		const key = `race${i}`;
		bindings[key] = races[i];
		racePlaceholders.push(`{:${key}}`);
	}

	const raceIn = racePlaceholders.join(', ');
	const lobbyPlayersJson = `CASE
          WHEN l.lobbyPlayers IS NOT NULL AND l.lobbyPlayers != '[]' THEN l.lobbyPlayers
          ELSE '[]'
        END`;
	const resultPlayersJson = `CASE
          WHEN l.result IS NOT NULL AND l.result != ''
               AND json_valid(l.result)
               AND json_type(json_extract(l.result, '$.players')) = 'array'
          THEN json_extract(l.result, '$.players')
          ELSE '[]'
        END`;

	if (!hasIdentity) {
		return `(
    EXISTS (
      SELECT 1 FROM json_each(${lobbyPlayersJson}) AS p
      WHERE CAST(json_extract(p.value, '$.race') AS INTEGER) IN (${raceIn})
    )
    OR EXISTS (
      SELECT 1 FROM json_each(${resultPlayersJson}) AS rp
      WHERE CAST(json_extract(rp.value, '$.race_id') AS INTEGER) IN (${raceIn})
    )
  )`;
	}

	const lobbyIdentity = [];
	const resultIdentity = [];

	for (let i = 0; i < steamIds.length; i++) {
		const steamKey = `raceSteam${i}`;
		const nameKey = `raceSteamName${i}`;
		bindings[steamKey] = steamIds[i];
		bindings[nameKey] = `/steam/${steamIds[i]}`;
		lobbyIdentity.push(`json_extract(p.value, '$.steamId') = {:${steamKey}}`);
		resultIdentity.push(`json_extract(rp.value, '$.steamId') = {:${steamKey}}`);
		resultIdentity.push(`json_extract(rp.value, '$.name') = {:${nameKey}}`);
	}

	for (let i = 0; i < profileIds.length; i++) {
		const key = `racePid${i}`;
		bindings[key] = profileIds[i];
		lobbyIdentity.push(
			`(CAST(json_extract(p.value, '$.profile_id') AS INTEGER) = {:${key}} OR CAST(json_extract(p.value, '$.profile.profile_id') AS INTEGER) = {:${key}})`
		);
		resultIdentity.push(
			`CAST(json_extract(rp.value, '$.profile_id') AS INTEGER) = {:${key}}`
		);
	}

	const lobbyIdentityClause = `(${lobbyIdentity.join(' OR ')})`;
	const resultIdentityClause = `(${resultIdentity.join(' OR ')})`;

	return `(
    EXISTS (
      SELECT 1 FROM json_each(${lobbyPlayersJson}) AS p
      WHERE ${lobbyIdentityClause}
        AND CAST(json_extract(p.value, '$.race') AS INTEGER) IN (${raceIn})
    )
    OR EXISTS (
      SELECT 1 FROM json_each(${resultPlayersJson}) AS rp
      WHERE ${resultIdentityClause}
        AND CAST(json_extract(rp.value, '$.race_id') AS INTEGER) IN (${raceIn})
    )
  )`;
}

/**
 * Lobbies the account uploaded, or that one of their Steam IDs (or Relic
 * profiles) actually played in. Index alias `pi` so callers can still use `i`.
 */
function userPlayedLobbyClause(lobbyAlias, { steamIds = [], profileIds = [] } = {}, bindings) {
	const alias = lobbyAlias || 'l';
	const played = [];
	for (let i = 0; i < steamIds.length; i++) {
		const key = `playedSid${i}`;
		bindings[key] = steamIds[i];
		played.push(`pi.steam_id = {:${key}}`);
	}
	for (let i = 0; i < profileIds.length; i++) {
		const key = `playedPid${i}`;
		bindings[key] = profileIds[i];
		played.push(`pi.profile_id = {:${key}}`);
	}
	if (steamIds.length === 0) {
		played.push(`pi.steam_id IN (
			SELECT CAST(json_each.value AS TEXT)
			FROM json_each(COALESCE((SELECT steamIds FROM users WHERE id = {:userId}), '[]'))
		)`);
	}
	if (played.length === 0) {
		return `${alias}.user = {:userId}`;
	}
	return `(${alias}.user = {:userId} OR EXISTS (
		SELECT 1 FROM lobby_player_index pi
		WHERE pi.lobby = ${alias}.id AND (${played.join(' OR ')})
	))`;
}

function loadUserSteamIds(userId) {
	if (!userId) {
		return [];
	}

	try {
		const row = new DynamicModel({ steamIds: '' });
		$app
			.db()
			.newQuery('SELECT CAST(steamIds AS TEXT) AS steamIds FROM users WHERE id = {:id}')
			.bind({ id: userId })
			.one(row);

		let raw = row.steamIds;
		if (raw == null || raw === '' || raw === '[]' || raw === 'null') {
			return [];
		}

		// goja/DynamicModel may expose TEXT JSON as a byte/char-code array
		if (typeof raw !== 'string') {
			if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'number') {
				let text = '';
				for (let i = 0; i < raw.length; i++) {
					text += String.fromCharCode(raw[i]);
				}
				raw = text;
			} else {
				try {
					raw = JSON.stringify(raw);
					// If this was already a real string array, stringify gives '["123",...]'.
					// If it was objects, also fine. If byte array somehow got here as something else, bail below.
				} catch {
					return [];
				}
			}
		}

		let parsed;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return [];
		}

		// JSON.stringify on a real JS string array then JSON.parse works.
		// JSON.stringify on byte array gives '[91,34,...]' — reject those.
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed.map(String).filter((id) => /^\d{10,}$/.test(id));
	} catch {
		return [];
	}
}

function asList(raw) {
	if (Array.isArray(raw)) {
		return raw;
	}

	if (typeof raw === 'string') {
		try {
			return asList(JSON.parse(raw));
		} catch {
			return [];
		}
	}

	if (raw && typeof raw === 'object') {
		return Object.keys(raw)
			.filter((key) => String(Number(key)) === key)
			.sort((a, b) => Number(a) - Number(b))
			.map((key) => raw[key]);
	}

	return [];
}

function steamIdFromName(name) {
	if (typeof name !== 'string') {
		return '';
	}

	return name.replace('/steam/', '');
}

/**
 * Transforms a Relic getrecentmatchhistory response into match objects.
 * Players with missing profile or report data are skipped (no throw).
 */
function transformMatchHistory(data, profileId) {
	const matches = asList(data?.matchHistoryStats);
	if (matches.length === 0) {
		return [];
	}

	const profileMap = {};
	for (const profile of asList(data?.profiles)) {
		const id = Number(profile?.profile_id);
		if (Number.isInteger(id) && id > 0) {
			profileMap[id] = profile;
		}
	}

	const transformed = [];

	for (const match of matches) {
		const reportResultsMap = {};
		for (const result of asList(match.matchhistoryreportresults)) {
			const id = Number(result?.profile_id);
			if (Number.isInteger(id) && id > 0) {
				reportResultsMap[id] = result;
			}
		}

		const players = [];
		for (const member of asList(match.matchhistorymember)) {
			const id = Number(member?.profile_id);
			const profile = profileMap[id];
			const reportResult = reportResultsMap[id];
			if (!profile || !reportResult) {
				continue;
			}

			players.push({
				profile_id: profile.profile_id,
				name: profile.name,
				alias: profile.alias,
				personal_statgroup_id: profile.personal_statgroup_id,
				xp: profile.xp,
				level: profile.level,
				leaderboardregion_id: profile.leaderboardregion_id,
				country: profile.country,
				steamId: steamIdFromName(profile.name),
				resulttype: reportResult.resulttype,
				teamid: reportResult.teamid,
				race_id: reportResult.race_id,
				xpgained: reportResult.xpgained,
				counters: reportResult.counters,
				matchstartdate: reportResult.matchstartdate,
				statgroup_id: member.statgroup_id,
				wins: member.wins,
				losses: member.losses,
				streak: member.streak,
				arbitration: member.arbitration,
				outcome: member.outcome,
				oldrating: member.oldrating,
				newrating: member.newrating,
				reporttype: member.reporttype
			});
		}

		if (players.length === 0) {
			continue;
		}

		const resolvedProfileId = Number(profileId);
		transformed.push({
			id: match.id,
			creator_profile_id: match.creator_profile_id,
			mapname: match.mapname,
			maxplayers: match.maxplayers,
			matchtype_id: match.matchtype_id,
			options: match.options,
			slotinfo: match.slotinfo,
			description: match.description,
			startgametime: match.startgametime,
			completiontime: match.completiontime,
			observertotal: match.observertotal,
			players,
			outcome:
				players.find((player) => Number(player.profile_id) === resolvedProfileId)?.outcome ?? 0
		});
	}

	return transformed;
}

/**
 * Prefer completed result, then newest createdAt among hasReplay lobbies.
 */
function isPreferredReplayLobby(candidate, current) {
	const candidateDone = !candidate.needsResult;
	const currentDone = !current.needsResult;
	if (candidateDone !== currentDone) {
		return candidateDone;
	}

	const candidateAt = String(candidate.createdAt || '');
	const currentAt = String(current.createdAt || '');
	return candidateAt > currentAt;
}

/**
 * Batch-resolve Relic session ids → community lobby ids that have a replay file.
 * Mutates matches in place with `lobbyId` when found.
 */
function attachReplayLobbyIds(matches) {
	if (!matches || matches.length === 0) {
		return matches;
	}

	const sessionIds = [];
	const seen = {};
	for (let i = 0; i < matches.length; i++) {
		const sessionId = Number(matches[i].id);
		if (!Number.isInteger(sessionId) || sessionId <= 0 || seen[sessionId]) {
			continue;
		}
		seen[sessionId] = true;
		sessionIds.push(sessionId);
	}

	if (sessionIds.length === 0) {
		return matches;
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
			createdAt: ''
		})
	);

	try {
		$app
			.db()
			.newQuery(
				`SELECT id,
          sessionId,
          COALESCE(needsResult, 1) AS needsResult,
          CAST(createdAt AS TEXT) AS createdAt
        FROM lobbies
        WHERE hasReplay = 1
          AND sessionId IN (${placeholders.join(', ')})`
			)
			.bind(bindings)
			.all(rows);
	} catch (error) {
		return matches;
	}

	const bySession = {};
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const sessionId = Number(row.sessionId);
		if (!Number.isInteger(sessionId) || sessionId <= 0 || !row.id) {
			continue;
		}
		const current = bySession[sessionId];
		if (!current || isPreferredReplayLobby(row, current)) {
			bySession[sessionId] = row;
		}
	}

	for (let i = 0; i < matches.length; i++) {
		const sessionId = Number(matches[i].id);
		const lobby = bySession[sessionId];
		matches[i].lobbyId = lobby ? String(lobby.id) : null;
	}

	return matches;
}

module.exports = {
	parseLobbyPlayersField,
	parseResultField,
	summarizePlayersFromLobbyField,
	loadPlayerAliasMap,
	summarizePlayersFromCsv,
	summarizePlayersFromResult,
	loadPlayersByLobbyIds,
	resolvePlayersForRow,
	countFilteredMatches,
	readCommunityMatchCount,
	saveCommunityMatchCount,
	invalidateCommunityMatchCount,
	ensureCommunityReplayIndex,
	parseOptionalNumber,
	buildRaceFilterClause,
	buildIndexPlayerConditions,
	buildProFilterClause,
	buildSortClause,
	parseCompareOp,
	compareClause,
	comparePlayerEloClause,
	loadUserSteamIds,
	userPlayedLobbyClause,
	asList,
	transformMatchHistory,
	attachReplayLobbyIds
};
