/**
 * Match-history filters -> PocketBase filter strings.
 *
 * Lobby-level conditions (map, ranked, pro, duration, match type) filter `lobbies`.
 * Player conditions (race, position, ELO, player id) live in `lobby_player_index`,
 * one row per player per lobby:
 *
 * - Conditions without a player id apply to the "subject": the signed-in user's own
 *   row in user scope, any single player in community scope.
 * - Conditions ANDed with a player id apply to that player ("X as US").
 *
 * PocketBase binds every `lobby_player_index_via_lobby.*` reference in one filter to
 * the same joined row, so only one row constraint can use that path. Every other
 * player group is resolved by the caller to lobby ids (`HistoryPlan.groups`), which
 * `render` inlines.
 *
 * User scope ("my matches" = games the user played or uploaded) renders as two
 * filters the service merges: `played`, rooted at the user's own index rows (cheap,
 * no DISTINCT over lobbies), and `uploaded`, on lobbies.
 */
import { z } from 'zod';

const VIA = 'lobby_player_index_via_lobby.';

/**
 * PocketBase rejects a filter longer than about 3500 characters; an inlined
 * `lobby.id = '…'` costs ~35, which leaves room for the rest of the filter.
 */
export const MAX_INLINE_IDS = 75;

/** A player combination matched more lobbies than fit in one PocketBase filter. */
export class TooManyMatchesError extends Error {
	constructor() {
		super(
			'This combination of players matches too many games. Add another filter to narrow it down.'
		);
	}
}

const compareOp = z.enum(['gt', 'gte', 'lt', 'lte']);
type CompareOp = z.infer<typeof compareOp>;

const OPERATORS: Record<CompareOp | 'eq', string> = {
	gt: '>',
	gte: '>=',
	lt: '<',
	lte: '<=',
	eq: '='
};

/** Relic match type ids per UI matchup (2v2 = ranked 2 or basic 5, ...). */
const MATCHUP_TYPES: Record<string, number[]> = {
	'1v1': [1],
	'2v2': [2, 5],
	'3v3': [3, 6],
	'4v4': [4, 7]
};
export function matchtypesForMatchups(matchups: string[]): number[] {
	return [...new Set(matchups.flatMap((matchup) => MATCHUP_TYPES[matchup] ?? []))];
}

/** Humans per match type, for lobbies whose result has no match type. */
const PLAYERS_PER_TYPE: Record<number, number> = { 1: 2, 2: 4, 3: 6, 4: 8, 5: 4, 6: 6, 7: 8 };

const oneOrMany = <T extends z.ZodType>(item: T) =>
	z
		.union([item, z.array(item)])
		.transform((value) => (Array.isArray(value) ? value : [value]) as z.infer<T>[]);

const leafSchema = z.discriminatedUnion('field', [
	z.object({
		field: z.literal('playerId'),
		op: z.enum(['eq', 'in']),
		value: oneOrMany(z.coerce.number().int().positive())
	}),
	z.object({
		field: z.literal('map'),
		op: z.enum(['eq', 'in']),
		value: oneOrMany(z.string().min(1).max(100))
	}),
	z.object({
		field: z.literal('race'),
		op: z.enum(['eq', 'in']),
		value: oneOrMany(z.coerce.number().int().min(0).max(3))
	}),
	z.object({
		field: z.literal('position'),
		op: z.enum(['eq', 'in']),
		value: oneOrMany(z.coerce.number().int().min(1).max(8))
	}),
	z.object({
		field: z.literal('matchup'),
		op: z.enum(['eq', 'in']),
		value: oneOrMany(z.enum(['1v1', '2v2', '3v3', '4v4']))
	}),
	z.object({ field: z.literal('ranked'), op: z.literal('eq'), value: z.boolean() }),
	z.object({ field: z.literal('pro'), op: z.literal('eq'), value: z.boolean() }),
	z.object({ field: z.literal('elo'), op: compareOp, value: z.number().finite() }),
	/** Minutes (UI unit). */
	z.object({ field: z.literal('duration'), op: compareOp, value: z.number().finite().min(0) }),
	/** Raw match type ids from the legacy flat query parameters; `exact` skips the player-count fallback. */
	z.object({
		field: z.literal('matchtype'),
		op: z.literal('in'),
		value: z.array(z.number().int()),
		exact: z.boolean()
	})
]);

export type FilterLeaf = z.infer<typeof leafSchema>;
export type FilterAst = FilterLeaf | { op: 'and' | 'or'; children: FilterAst[] };

export const filterAstSchema: z.ZodType<FilterAst> = z.lazy(() =>
	z.union([
		leafSchema,
		z.object({ op: z.enum(['and', 'or']), children: z.array(filterAstSchema).max(30) })
	])
);

export type FlatHistoryParams = {
	ranked?: boolean;
	pro?: boolean;
	playerIds?: number[];
	maps?: string[];
	races?: number[];
	slots?: number[];
	matchtypes?: number[];
	exactMatchtypes?: boolean;
	elo?: { op: CompareOp; value: number };
	durationSeconds?: { op: CompareOp; value: number };
};

/** The legacy flat query parameters as one AND group (same meaning as before). */
export function flatParamsToAst(flat: FlatHistoryParams): FilterAst | null {
	const children: FilterLeaf[] = [];
	if (flat.ranked) {
		children.push({ field: 'ranked', op: 'eq', value: true });
	}

	if (flat.pro) {
		children.push({ field: 'pro', op: 'eq', value: true });
	}

	if (flat.playerIds?.length) {
		children.push({ field: 'playerId', op: 'in', value: flat.playerIds });
	}

	if (flat.maps?.length) {
		children.push({ field: 'map', op: 'in', value: flat.maps });
	}

	if (flat.races?.length) {
		children.push({ field: 'race', op: 'in', value: flat.races });
	}

	if (flat.slots?.length) {
		children.push({ field: 'position', op: 'in', value: flat.slots });
	}

	if (flat.matchtypes?.length) {
		children.push({
			field: 'matchtype',
			op: 'in',
			value: flat.matchtypes,
			exact: !!flat.exactMatchtypes
		});
	}

	if (flat.elo) {
		children.push({ field: 'elo', op: flat.elo.op, value: flat.elo.value });
	}

	if (flat.durationSeconds) {
		children.push({
			field: 'duration',
			op: flat.durationSeconds.op,
			value: flat.durationSeconds.value / 60
		});
	}

	if (children.length === 0) {
		return null;
	}

	return children.length === 1 ? children[0] : { op: 'and', children };
}

export function quote(value: string): string {
	return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function anyOf(parts: string[]): string {
	return parts.length === 1 ? parts[0] : `(${parts.join(' || ')})`;
}

// ---- conditions ----------------------------------------------------------------

type PlayerLeaf = Extract<FilterLeaf, { field: 'playerId' | 'race' | 'position' | 'elo' }>;
type LobbyLeaf = Exclude<FilterLeaf, PlayerLeaf>;

function isPlayerLeaf(node: FilterAst): node is PlayerLeaf {
	return 'field' in node && ['playerId', 'race', 'position', 'elo'].includes(node.field);
}

/**
 * Conditions on one index row. `prefix` is '' on the index itself, or a relation
 * path; through a multi-row path the operators need the `?` (any) form.
 */
function rowConditions(leaves: PlayerLeaf[], prefix: string, any: boolean): string {
	const op = (symbol: string) => (any ? `?${symbol}` : symbol);
	const conditions: string[] = [];
	for (const leaf of leaves) {
		if (leaf.field === 'playerId') {
			conditions.push(anyOf(leaf.value.map((id) => `${prefix}profile_id ${op('=')} ${id}`)));
		} else if (leaf.field === 'race') {
			conditions.push(anyOf(leaf.value.map((race) => `${prefix}race_id ${op('=')} ${race}`)));
		} else if (leaf.field === 'position') {
			conditions.push(anyOf(leaf.value.map((slot) => `${prefix}slot ${op('=')} ${slot}`)));
		} else {
			// A player without a known rating (elo 0) never matches, whatever the operator.
			conditions.push(
				`${prefix}elo ${op('>')} 0 && ${prefix}elo ${op(OPERATORS[leaf.op])} ${leaf.value}`
			);
		}
	}
	return conditions.join(' && ');
}

function matchtypeCondition(ids: number[], exact: boolean, prefix: string): string | null {
	const unique = [...new Set(ids)];
	if (unique.length === 0) {
		return null;
	}

	const parts = unique.map((id) => `${prefix}matchtypeId = ${id}`);
	const counts = exact
		? []
		: [...new Set(unique.map((id) => PLAYERS_PER_TYPE[id]).filter(Boolean))];
	if (counts.length > 0) {
		parts.push(
			`(${prefix}matchtypeId = 0 && ${anyOf(counts.map((count) => `${prefix}playerCount = ${count}`))})`
		);
	}

	return anyOf(parts);
}

function lobbyCondition(leaf: LobbyLeaf, prefix: string): string | null {
	switch (leaf.field) {
		case 'map':
			return anyOf(leaf.value.map((map) => `${prefix}map = ${quote(map)}`));
		case 'ranked':
			return `${prefix}isRanked = ${leaf.value}`;
		case 'pro':
			return `${prefix}isPro = ${leaf.value}`;
		case 'duration':
			return `${prefix}durationSeconds ${OPERATORS[leaf.op]} ${Math.round(leaf.value * 60)}`;
		case 'matchup':
			return matchtypeCondition(matchtypesForMatchups(leaf.value), false, prefix);
		case 'matchtype':
			return matchtypeCondition(leaf.value, leaf.exact, prefix);
	}
}

// ---- compile -------------------------------------------------------------------

/** A player constraint needing its own index row: some player id(s) plus conditions on that row. */
type PlayerGroup = { leaves: PlayerLeaf[] };

type Node =
	| { kind: 'and' | 'or'; children: Node[] }
	| { kind: 'lobby'; leaf: LobbyLeaf }
	| { kind: 'subject'; leaves: PlayerLeaf[] }
	| { kind: 'group'; index: number };

function flatten(node: FilterAst): FilterAst {
	if ('field' in node) {
		return node;
	}

	const children: FilterAst[] = [];
	for (const child of node.children.map(flatten)) {
		if (!('field' in child) && child.op === node.op) {
			children.push(...child.children);
		} else {
			children.push(child);
		}
	}
	return { op: node.op, children };
}

function compile(node: FilterAst, groups: PlayerGroup[]): Node | null {
	if ('field' in node) {
		if (!isPlayerLeaf(node)) {
			return { kind: 'lobby', leaf: node };
		}

		if (node.field === 'playerId') {
			groups.push({ leaves: [node] });
			return { kind: 'group', index: groups.length - 1 };
		}

		return { kind: 'subject', leaves: [node] };
	}

	const children: Node[] = [];
	const flat = flatten(node) as { op: 'and' | 'or'; children: FilterAst[] };
	if (flat.op === 'and') {
		// Player conditions ANDed with player ids belong to those players; without one, to the subject.
		const playerLeaves = flat.children.filter(isPlayerLeaf);
		const idLeaves = playerLeaves.filter((leaf) => leaf.field === 'playerId');
		const rowLeaves = playerLeaves.filter((leaf) => leaf.field !== 'playerId');
		if (idLeaves.length === 0 && rowLeaves.length > 0) {
			children.push({ kind: 'subject', leaves: rowLeaves });
		}

		for (const idLeaf of idLeaves) {
			groups.push({ leaves: [idLeaf, ...rowLeaves] });
			children.push({ kind: 'group', index: groups.length - 1 });
		}
	}

	for (const child of flat.children) {
		if (flat.op === 'and' && isPlayerLeaf(child)) {
			continue;
		}

		const compiled = compile(child, groups);
		if (compiled) {
			children.push(compiled);
		}
	}

	if (children.length === 0) {
		return null;
	}

	return children.length === 1 ? children[0] : { kind: flat.op, children };
}

function topLevel(node: Node | null): Node[] {
	if (!node) {
		return [];
	}

	return node.kind === 'and' ? node.children : [node];
}

function containsSubject(node: Node | null): boolean {
	if (!node) {
		return false;
	}

	if (node.kind === 'subject') {
		return true;
	}

	return (node.kind === 'and' || node.kind === 'or') && node.children.some(containsSubject);
}

// ---- plan ----------------------------------------------------------------------

export type HistoryScope =
	| { kind: 'community'; includeHidden: boolean; includeSkirmish: boolean }
	| {
			kind: 'user';
			userId: string;
			steamIds: string[];
			profileIds: number[];
			includeHidden: boolean;
			includeSkirmish: boolean;
	  };

/**
 * Where a filter is rooted. On `lobbies` the lobby id is `id` and the subject goes
 * through the via join; on `lobby_player_index` the lobby is the `lobby` relation
 * and the subject is the root row itself.
 */
type Target = { lobby: string; via: string; subjectOnRoot: boolean; id: string };
const ON_LOBBIES: Target = { lobby: '', via: VIA, subjectOnRoot: false, id: 'id' };
const ON_INDEX: Target = { lobby: 'lobby.', via: `lobby.${VIA}`, subjectOnRoot: true, id: 'lobby' };

export type HistoryFilters =
	/** Filter on `lobbies`. */
	| { kind: 'lobbies'; filter: string }
	/**
	 * User scope. `played`: filter on `lobby_player_index` rows of the user (select
	 * `lobby`), null when the account has no Steam ids. `uploaded`: filter on `lobbies`,
	 * null when conditions apply to the user's own row (uploading is not playing).
	 */
	| { kind: 'user'; played: string | null; uploaded: string | null };

export type HistoryPlan = {
	/** Player groups to resolve to lobby ids: `lobby_player_index` filters (select `lobby`). */
	groups: { index: number; filter: string }[];
	/** True when no filter beyond the scope applies (an exact total count is cheap). */
	unfiltered: boolean;
	render(resolved: Map<number, string[]>): HistoryFilters;
};

/** Scope conditions on lobbies, relative to `prefix` ('' on lobbies, 'lobby.' from the index). */
function scopeConditions(scope: HistoryScope, prefix: string): string[] {
	const conditions = scope.includeSkirmish
		? [`(${prefix}needsResult = false || ${prefix}title = 'Skirmish')`]
		: [`${prefix}needsResult = false`, `${prefix}title != 'Skirmish'`];
	if (!scope.includeHidden) {
		conditions.push(`${prefix}isHidden = false`);
	}

	if (scope.kind === 'community') {
		conditions.push(
			scope.includeSkirmish
				? `${prefix}hasReplay = true && ${prefix}memberReplay = ''`
				: `${prefix}isCommunity = true`
		);
	}

	return conditions;
}

type UserScope = Extract<HistoryScope, { kind: 'user' }>;

/** The user's own index rows: their Steam ids or the requested Relic profile. */
function identityCondition(scope: UserScope, prefix: string, any: boolean): string | null {
	const eq = any ? '?=' : '=';
	const parts = [
		...scope.steamIds.map((steamId) => `${prefix}steam_id ${eq} ${quote(steamId)}`),
		...scope.profileIds.map((profileId) => `${prefix}profile_id ${eq} ${profileId}`)
	];
	return parts.length > 0 ? anyOf(parts) : null;
}

export function planHistoryQuery(ast: FilterAst | null, scope: HistoryScope): HistoryPlan {
	const playerGroups: PlayerGroup[] = [];
	const tree = ast ? compile(ast, playerGroups) : null;
	const hasSubject = containsSubject(tree);

	// The via join is free unless community-scope subject conditions need it; then the
	// first top-level group gets it (or the only group, wherever it is).
	const viaTaken = scope.kind === 'community' && hasSubject;
	const topGroups = topLevel(tree).filter(
		(node): node is { kind: 'group'; index: number } => node.kind === 'group'
	);
	const viaGroup = viaTaken
		? null
		: (topGroups[0]?.index ?? (playerGroups.length === 1 ? 0 : null));
	const topGroupIndexes = new Set(topGroups.map((node) => node.index));

	// Resolved groups are narrowed to the scope so their id lists stay small: to games
	// with the via group's player when both are required, else (user scope) to the
	// user's games. Only one of the two, since both would use the same via join.
	const userNarrowing = (() => {
		if (scope.kind !== 'user') {
			return null;
		}

		const played = identityCondition(scope, `lobby.${VIA}`, true);
		const uploaded = `lobby.user = ${quote(scope.userId)}`;
		return played ? anyOf([uploaded, played]) : uploaded;
	})();
	const groups = playerGroups
		.map((group, index) => ({ group, index }))
		.filter(({ index }) => index !== viaGroup)
		.map(({ group, index }) => {
			const conditions = [
				rowConditions(group.leaves, '', false),
				...scopeConditions(scope, 'lobby.')
			];
			if (viaGroup !== null && topGroupIndexes.has(index)) {
				conditions.push(rowConditions(playerGroups[viaGroup].leaves, `lobby.${VIA}`, true));
			} else if (userNarrowing) {
				conditions.push(userNarrowing);
			}

			return { index, filter: conditions.join(' && ') };
		});

	function render(resolved: Map<number, string[]>): HistoryFilters {
		function renderFor(target: Target, base: string[]): string {
			let inlined = 0; // PocketBase limits expressions per filter
			const idCondition = (ids: string[]) => {
				inlined += ids.length;
				if (inlined > MAX_INLINE_IDS) {
					throw new TooManyMatchesError();
				}

				return ids.length === 0
					? `${target.id} = ''`
					: anyOf(ids.map((id) => `${target.id} = ${quote(id)}`));
			};

			function renderNode(node: Node, isTop: boolean): string | null {
				switch (node.kind) {
					case 'lobby':
						return lobbyCondition(node.leaf, target.lobby);
					case 'subject':
						return target.subjectOnRoot
							? rowConditions(node.leaves, '', false)
							: rowConditions(node.leaves, target.via, true);
					case 'group':
						if (node.index === viaGroup) {
							return rowConditions(playerGroups[node.index].leaves, target.via, true);
						}

						if (isTop) {
							return null;
						}

						// intersected below
						return idCondition(resolved.get(node.index) ?? []);
					default: {
						const parts = node.children
							.map((child) => renderNode(child, false))
							.filter((part): part is string => !!part);
						if (parts.length === 0) {
							return null;
						}

						return parts.length === 1
							? parts[0]
							: `(${parts.join(node.kind === 'and' ? ' && ' : ' || ')})`;
					}
				}
			}

			const conditions = [...base, ...scopeConditions(scope, target.lobby)];
			for (const node of topLevel(tree)) {
				const rendered = renderNode(node, true);
				if (rendered) {
					conditions.push(rendered);
				}
			}
			// Top-level groups are all required: one intersected id list covers them.
			const required = topGroups
				.filter((node) => node.index !== viaGroup)
				.map((node) => resolved.get(node.index) ?? []);
			if (required.length > 0) {
				const [first, ...rest] = required;
				conditions.push(idCondition(first.filter((id) => rest.every((ids) => ids.includes(id)))));
			}

			return conditions.join(' && ');
		}

		if (scope.kind === 'community') {
			return { kind: 'lobbies', filter: renderFor(ON_LOBBIES, []) };
		}

		const identity = identityCondition(scope, '', false);
		return {
			kind: 'user',
			played: identity ? renderFor(ON_INDEX, [identity]) : null,
			uploaded: hasSubject ? null : renderFor(ON_LOBBIES, [`user = ${quote(scope.userId)}`])
		};
	}

	return { groups, unfiltered: tree === null, render };
}
