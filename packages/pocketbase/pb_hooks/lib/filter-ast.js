/**
 * Filter AST compiler for match-history SQL (PocketBase JSVM / CommonJS).
 * Leaves compile to EXISTS or lobby column predicates; groups combine with AND/OR.
 */

'use strict';

const HISTORY_MATCHUP_TYPES = {
	'1v1': [1],
	'2v2': [2, 5],
	'3v3': [3, 6],
	'4v4': [4, 7]
};

function isLeaf(node) {
	return node && typeof node === 'object' && typeof node.field === 'string';
}

function isGroup(node) {
	return node && typeof node === 'object' && (node.op === 'and' || node.op === 'or') && Array.isArray(node.children);
}

/** Starting lobby slots are 1-based (1–8 in 4v4). */
function slotsForPositions(positions) {
	const slots = [];
	const seen = {};
	for (let i = 0; i < positions.length; i++) {
		const slot = Number(positions[i]);
		if (!Number.isInteger(slot) || slot < 1 || slot > 8) {
			continue;
		}
		if (!seen[slot]) {
			seen[slot] = true;
			slots.push(slot);
		}
	}
	return slots;
}

function matchtypesForMatchups(matchups) {
	const ids = [];
	const seen = {};
	for (let i = 0; i < matchups.length; i++) {
		const types = HISTORY_MATCHUP_TYPES[matchups[i]];
		if (!types) {
			continue;
		}
		for (let j = 0; j < types.length; j++) {
			const id = types[j];
			if (!seen[id]) {
				seen[id] = true;
				ids.push(id);
			}
		}
	}
	return ids;
}

function nextKey(bindings, prefix) {
	let i = 0;
	while (Object.prototype.hasOwnProperty.call(bindings, prefix + i)) {
		i += 1;
	}
	return prefix + i;
}

function compareSql(column, op, key, value, bindings) {
	bindings[key] = value;
	if (op === 'gt') {
		return `${column} > {:${key}}`;
	}
	if (op === 'gte') {
		return `${column} >= {:${key}}`;
	}
	if (op === 'lt') {
		return `${column} < {:${key}}`;
	}
	if (op === 'lte') {
		return `${column} <= {:${key}}`;
	}
	return `${column} = {:${key}}`;
}

function inOrEq(column, op, values, bindings, prefix) {
	const list = op === 'eq' ? [values] : values;
	const arr = Array.isArray(list) ? list : [list];
	if (arr.length === 0) {
		return null;
	}
	const parts = [];
	for (let i = 0; i < arr.length; i++) {
		const key = nextKey(bindings, prefix);
		bindings[key] = arr[i];
		parts.push(`${column} = {:${key}}`);
	}
	if (parts.length === 1) {
		return parts[0];
	}
	return `(${parts.join(' OR ')})`;
}

function existsIndex(innerSql) {
	return `EXISTS (SELECT 1 FROM lobby_player_index i WHERE i.lobby = l.id AND ${innerSql})`;
}

function playerIdInner(leaf, bindings) {
	const ids = leaf.op === 'eq' ? [leaf.value] : leaf.value;
	const numeric = [];
	for (let i = 0; i < ids.length; i++) {
		const n = Number(ids[i]);
		if (!Number.isNaN(n)) {
			numeric.push(n);
		}
	}
	if (numeric.length === 0) {
		return null;
	}
	const parts = [];
	for (let i = 0; i < numeric.length; i++) {
		const key = nextKey(bindings, 'fpid');
		bindings[key] = numeric[i];
		parts.push(`i.profile_id = {:${key}}`);
	}
	return parts.length === 1 ? parts[0] : `(${parts.join(' OR ')})`;
}

function raceInner(leaf, bindings) {
	const races = leaf.op === 'eq' ? [leaf.value] : leaf.value;
	const numeric = [];
	for (let i = 0; i < races.length; i++) {
		const n = Number(races[i]);
		if (!Number.isNaN(n) && n >= 0 && n <= 3) {
			numeric.push(n);
		}
	}
	if (numeric.length === 0) {
		return null;
	}
	const parts = [];
	for (let i = 0; i < numeric.length; i++) {
		const key = nextKey(bindings, 'frace');
		bindings[key] = numeric[i];
		parts.push(`{:${key}}`);
	}
	return `i.race_id IN (${parts.join(', ')})`;
}

function positionInner(leaf, bindings) {
	const positions = leaf.op === 'eq' ? [leaf.value] : leaf.value;
	const slots = slotsForPositions(positions);
	if (slots.length === 0) {
		return null;
	}
	const parts = [];
	for (let i = 0; i < slots.length; i++) {
		const key = nextKey(bindings, 'fslot');
		bindings[key] = slots[i];
		parts.push(`{:${key}}`);
	}
	// Indexed column only (see match-history buildIndexPlayerConditions).
	return `i.slot IN (${parts.join(', ')})`;
}

function eloInner(leaf, bindings, helpers) {
	const key = nextKey(bindings, 'felo');
	if (helpers.comparePlayerEloClause) {
		return helpers.comparePlayerEloClause(leaf.op, Number(leaf.value), bindings);
	}
	return compareSql('i.elo', leaf.op, key, Number(leaf.value), bindings);
}

function isPlayerScopedLeaf(node) {
	return (
		isLeaf(node) &&
		(node.field === 'playerId' ||
			node.field === 'race' ||
			node.field === 'position' ||
			node.field === 'elo')
	);
}

/**
 * AND of player-scoped leaves must share one lobby_player_index row
 * (player + faction + starting slot + elo), matching legacy composition filters.
 * Multiple playerId leaves stay separate EXISTS, each including compose predicates.
 */
function compilePlayerScopedAnd(leaves, bindings, helpers) {
	const playerLeaves = [];
	const composeParts = [];

	for (let i = 0; i < leaves.length; i++) {
		const leaf = leaves[i];
		if (leaf.field === 'playerId') {
			playerLeaves.push(leaf);
			continue;
		}
		let inner = null;
		if (leaf.field === 'race') {
			inner = raceInner(leaf, bindings);
		} else if (leaf.field === 'position') {
			inner = positionInner(leaf, bindings);
		} else if (leaf.field === 'elo') {
			inner = eloInner(leaf, bindings, helpers);
		}
		if (inner) {
			composeParts.push(inner);
		}
	}

	const parts = [];
	if (playerLeaves.length === 0) {
		if (composeParts.length === 0) {
			return parts;
		}
		parts.push(existsIndex(composeParts.join(' AND ')));
		return parts;
	}

	for (let i = 0; i < playerLeaves.length; i++) {
		const playerInner = playerIdInner(playerLeaves[i], bindings);
		if (!playerInner) {
			continue;
		}
		const combined =
			composeParts.length > 0 ? `${playerInner} AND ${composeParts.join(' AND ')}` : playerInner;
		parts.push(existsIndex(combined));
	}
	return parts;
}

function compileLeaf(leaf, bindings, helpers) {
	const field = leaf.field;
	const op = leaf.op;

	if (field === 'map') {
		return inOrEq('l.map', op, leaf.value, bindings, 'fmap');
	}

	if (field === 'ranked') {
		return leaf.value ? 'l.isRanked = 1' : 'l.isRanked = 0';
	}

	if (field === 'pro') {
		const clause = helpers.buildProFilterClause();
		return leaf.value ? `(${clause})` : `NOT (${clause})`;
	}

	if (field === 'duration') {
		const key = nextKey(bindings, 'fdur');
		// UI duration leaf is minutes; compiler multiplies by 60.
		const seconds = Number(leaf.value) * 60;
		return helpers.compareClause('l.durationSeconds', op, key, seconds, bindings);
	}

	if (field === 'matchup') {
		const matchups = op === 'eq' ? [leaf.value] : leaf.value;
		const matchtypes = matchtypesForMatchups(matchups);
		if (matchtypes.length === 0) {
			return null;
		}
		const placeholders = [];
		const playerCountKeys = [];
		const playerCountByType = { 1: 2, 2: 4, 3: 6, 4: 8, 5: 4, 6: 6, 7: 8 };
		const playerCounts = {};
		for (let i = 0; i < matchtypes.length; i++) {
			const key = nextKey(bindings, 'fmt');
			bindings[key] = matchtypes[i];
			placeholders.push(`{:${key}}`);
			const count = playerCountByType[matchtypes[i]];
			if (count && !playerCounts[count]) {
				playerCounts[count] = true;
				const countKey = nextKey(bindings, 'fmpc');
				bindings[countKey] = count;
				playerCountKeys.push(`{:${countKey}}`);
			}
		}
		const typeClause = `CAST(json_extract(l.result, '$.matchtype_id') AS INTEGER) IN (${placeholders.join(', ')})`;
		if (playerCountKeys.length > 0) {
			return `(${typeClause}
          OR (
            (json_extract(l.result, '$.matchtype_id') IS NULL
              OR CAST(json_extract(l.result, '$.matchtype_id') AS INTEGER) = 0)
            AND json_array_length(json_extract(l.result, '$.players')) IN (${playerCountKeys.join(', ')})
          ))`;
		}
		return typeClause;
	}

	if (field === 'playerId') {
		const inner = playerIdInner(leaf, bindings);
		return inner ? existsIndex(inner) : null;
	}

	if (field === 'race') {
		const inner = raceInner(leaf, bindings);
		return inner ? existsIndex(inner) : null;
	}

	if (field === 'position') {
		const inner = positionInner(leaf, bindings);
		return inner ? existsIndex(inner) : null;
	}

	if (field === 'elo') {
		const inner = eloInner(leaf, bindings, helpers);
		return inner ? existsIndex(inner) : null;
	}

	return null;
}

function compileAndChildren(children, bindings, helpers) {
	const parts = [];
	const scoped = [];

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (isPlayerScopedLeaf(child)) {
			scoped.push(child);
			continue;
		}
		const sql = compileNode(child, bindings, helpers);
		if (sql) {
			parts.push(sql);
		}
	}

	const merged = compilePlayerScopedAnd(scoped, bindings, helpers);
	for (let i = 0; i < merged.length; i++) {
		parts.push(merged[i]);
	}
	return parts;
}

/** Collapse nested same-op groups so AND siblings can compose in one pass. */
function flattenGroup(node) {
	if (!isGroup(node) || !node.children || node.children.length === 0) {
		return node;
	}

	const flat = [];
	for (let i = 0; i < node.children.length; i++) {
		const child = flattenGroup(node.children[i]);
		if (isGroup(child) && child.op === node.op && child.children) {
			for (let j = 0; j < child.children.length; j++) {
				flat.push(child.children[j]);
			}
		} else {
			flat.push(child);
		}
	}
	return { op: node.op, children: flat };
}

function compileNode(node, bindings, helpers) {
	if (!node) {
		return null;
	}
	if (isLeaf(node)) {
		return compileLeaf(node, bindings, helpers);
	}
	if (!isGroup(node) || !node.children || node.children.length === 0) {
		return null;
	}

	const flat = flattenGroup(node);
	const parts =
		flat.op === 'and'
			? compileAndChildren(flat.children, bindings, helpers)
			: (() => {
					const orParts = [];
					for (let i = 0; i < flat.children.length; i++) {
						const sql = compileNode(flat.children[i], bindings, helpers);
						if (sql) {
							orParts.push(sql);
						}
					}
					return orParts;
				})();

	if (parts.length === 0) {
		return null;
	}
	if (parts.length === 1) {
		return parts[0];
	}
	const joiner = flat.op === 'or' ? ' OR ' : ' AND ';
	return `(${parts.join(joiner)})`;
}

function parseFilterParam(raw) {
	if (!raw) {
		return null;
	}
	try {
		const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
		if (isLeaf(parsed) || isGroup(parsed)) {
			return parsed;
		}
	} catch {
		return null;
	}
	return null;
}

function flatParamsToAst(params) {
	const children = [];
	if (params.ranked) {
		children.push({ field: 'ranked', op: 'eq', value: true });
	}
	if (params.pro) {
		children.push({ field: 'pro', op: 'eq', value: true });
	}
	if (params.playerIds && params.playerIds.length === 1) {
		children.push({ field: 'playerId', op: 'eq', value: String(params.playerIds[0]) });
	} else if (params.playerIds && params.playerIds.length > 1) {
		children.push({
			field: 'playerId',
			op: 'in',
			value: params.playerIds.map(String)
		});
	}
	if (params.maps && params.maps.length === 1) {
		children.push({ field: 'map', op: 'eq', value: params.maps[0] });
	} else if (params.maps && params.maps.length > 1) {
		children.push({ field: 'map', op: 'in', value: params.maps.slice() });
	}
	if (params.races && params.races.length === 1) {
		children.push({ field: 'race', op: 'eq', value: String(params.races[0]) });
	} else if (params.races && params.races.length > 1) {
		children.push({
			field: 'race',
			op: 'in',
			value: params.races.map(String)
		});
	}
	if (params.matchups && params.matchups.length > 0) {
		children.push({
			field: 'matchup',
			op: params.matchups.length === 1 ? 'eq' : 'in',
			value: params.matchups.length === 1 ? params.matchups[0] : params.matchups.slice()
		});
	} else if (params.matchtypes && params.matchtypes.length > 0) {
		// Flat matchtypes without matchup labels — keep as duration-less: encode via synthetic matchup skip
		// Leave to legacy path if only matchtypes; return null so caller uses legacy.
		return null;
	}
	if (params.positions && params.positions.length === 1) {
		children.push({ field: 'position', op: 'eq', value: String(params.positions[0]) });
	} else if (params.positions && params.positions.length > 1) {
		children.push({
			field: 'position',
			op: 'in',
			value: params.positions.map(String)
		});
	}
	if (params.eloOp && Number.isFinite(params.eloValue)) {
		children.push({ field: 'elo', op: params.eloOp, value: params.eloValue });
	}
	if (params.durationOp && Number.isFinite(params.durationSeconds)) {
		children.push({
			field: 'duration',
			op: params.durationOp,
			value: params.durationSeconds / 60
		});
	}
	if (children.length === 0) {
		return null;
	}
	if (children.length === 1) {
		return children[0];
	}
	return { op: 'and', children };
}

/**
 * Compile AST to SQL fragment (no leading AND). Returns null if empty.
 * @param {object} helpers — buildProFilterClause, compareClause, comparePlayerEloClause?, playerSlotExpr?
 */
function compileFilterAst(ast, bindings, helpers) {
	return compileNode(ast, bindings, helpers || {});
}

module.exports = {
	parseFilterParam,
	flatParamsToAst,
	compileFilterAst,
	isLeaf,
	isGroup,
	matchtypesForMatchups,
	slotsForPositions
};
