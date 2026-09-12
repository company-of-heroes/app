import type { FilterOperator, HistoryMatchup } from './types';

export type FilterCombinator = 'and' | 'or';

export type FilterField =
	| 'playerId'
	| 'map'
	| 'race'
	| 'matchup'
	| 'position'
	| 'ranked'
	| 'pro'
	| 'elo'
	| 'duration';

export type FilterLeafOp = 'eq' | 'in' | 'gt' | 'gte' | 'lt' | 'lte';

export type FilterLeaf =
	| { field: 'playerId'; op: 'eq'; value: string }
	| { field: 'playerId'; op: 'in'; value: string[] }
	| { field: 'map'; op: 'eq'; value: string }
	| { field: 'map'; op: 'in'; value: string[] }
	| { field: 'race'; op: 'eq'; value: string }
	| { field: 'race'; op: 'in'; value: string[] }
	| { field: 'matchup'; op: 'eq'; value: HistoryMatchup }
	| { field: 'matchup'; op: 'in'; value: HistoryMatchup[] }
	| { field: 'position'; op: 'eq'; value: string }
	| { field: 'position'; op: 'in'; value: string[] }
	| { field: 'ranked'; op: 'eq'; value: boolean }
	| { field: 'pro'; op: 'eq'; value: boolean }
	| { field: 'elo'; op: FilterOperator; value: number }
	| { field: 'duration'; op: FilterOperator; value: number };

export type FilterAst = { op: FilterCombinator; children: FilterAst[] } | FilterLeaf;

export type FilterRule = {
	id: string;
	/** Combinator joining this rule to the previous one; omitted on the first rule. */
	join?: FilterCombinator;
	leaf: FilterLeaf | null;
};

export type FlatHistoryFilters = {
	ranked?: boolean;
	pro?: boolean;
	playerIds?: string[];
	maps?: string[];
	races?: string[];
	matchups?: HistoryMatchup[];
	positions?: string[];
	elo?: { op: FilterOperator; value: number } | null;
	duration?: { op: FilterOperator; value: number } | null;
};

let ruleId = 0;

export function newRuleId() {
	ruleId += 1;
	return `r${ruleId}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isFilterLeaf(node: FilterAst): node is FilterLeaf {
	return 'field' in node;
}

export function isFilterGroup(node: FilterAst): node is { op: FilterCombinator; children: FilterAst[] } {
	return 'op' in node && 'children' in node && !('field' in node);
}

/** Left-fold flat rules into a binary AST: ((a AND b) OR c). Skips incomplete rules. */
export function rulesToAst(rules: FilterRule[]): FilterAst | null {
	const complete = rules.filter((rule) => rule.leaf != null && isLeafComplete(rule.leaf));
	if (complete.length === 0) {
		return null;
	}

	let ast: FilterAst = complete[0].leaf!;
	for (let i = 1; i < complete.length; i++) {
		const join = complete[i].join ?? 'and';
		ast = { op: join, children: [ast, complete[i].leaf!] };
	}
	return ast;
}

export function isLeafComplete(leaf: FilterLeaf): boolean {
	switch (leaf.field) {
		case 'playerId':
		case 'map':
		case 'race':
		case 'matchup':
		case 'position':
			if (leaf.op === 'in') {
				return Array.isArray(leaf.value) && leaf.value.length > 0;
			}
			return leaf.value != null && String(leaf.value).length > 0;
		case 'ranked':
		case 'pro':
			return typeof leaf.value === 'boolean';
		case 'elo':
		case 'duration':
			return Number.isFinite(leaf.value);
		default:
			return false;
	}
}

/**
 * Best-effort flatten of a left-associated binary tree into rules.
 * Nested/non-left shapes fall back to a single synthetic rule list via DFS with AND joins.
 */
export function astToRules(ast: FilterAst | null | undefined): FilterRule[] {
	if (!ast) {
		return [];
	}

	const rules: FilterRule[] = [];

	function walk(node: FilterAst, join?: FilterCombinator) {
		if (isFilterLeaf(node)) {
			rules.push({ id: newRuleId(), join, leaf: node });
			return;
		}

		if (node.children.length === 0) {
			return;
		}

		if (
			node.children.length === 2 &&
			isFilterLeaf(node.children[1]) &&
			(isFilterLeaf(node.children[0]) || isFilterGroup(node.children[0]))
		) {
			walk(node.children[0], join);
			walk(node.children[1], node.op);
			return;
		}

		for (let i = 0; i < node.children.length; i++) {
			walk(node.children[i], i === 0 ? join : node.op);
		}
	}

	walk(ast);
	if (rules.length > 0) {
		delete rules[0].join;
	}
	return rules;
}

/** Compile legacy flat filters into an AND group (current API semantics: multi = IN/any). */
export function flatFiltersToAst(flat: FlatHistoryFilters): FilterAst | null {
	const children: FilterAst[] = [];

	if (flat.ranked) {
		children.push({ field: 'ranked', op: 'eq', value: true });
	}
	if (flat.pro) {
		children.push({ field: 'pro', op: 'eq', value: true });
	}
	if (flat.playerIds && flat.playerIds.length === 1) {
		children.push({ field: 'playerId', op: 'eq', value: flat.playerIds[0] });
	} else if (flat.playerIds && flat.playerIds.length > 1) {
		children.push({ field: 'playerId', op: 'in', value: [...flat.playerIds] });
	}
	if (flat.maps && flat.maps.length === 1) {
		children.push({ field: 'map', op: 'eq', value: flat.maps[0] });
	} else if (flat.maps && flat.maps.length > 1) {
		children.push({ field: 'map', op: 'in', value: [...flat.maps] });
	}
	if (flat.races && flat.races.length === 1) {
		children.push({ field: 'race', op: 'eq', value: flat.races[0] });
	} else if (flat.races && flat.races.length > 1) {
		children.push({ field: 'race', op: 'in', value: [...flat.races] });
	}
	if (flat.matchups && flat.matchups.length === 1) {
		children.push({ field: 'matchup', op: 'eq', value: flat.matchups[0] });
	} else if (flat.matchups && flat.matchups.length > 1) {
		children.push({ field: 'matchup', op: 'in', value: [...flat.matchups] });
	}
	if (flat.positions && flat.positions.length === 1) {
		children.push({ field: 'position', op: 'eq', value: flat.positions[0] });
	} else if (flat.positions && flat.positions.length > 1) {
		children.push({ field: 'position', op: 'in', value: [...flat.positions] });
	}
	if (flat.elo) {
		children.push({ field: 'elo', op: flat.elo.op, value: flat.elo.value });
	}
	if (flat.duration) {
		children.push({ field: 'duration', op: flat.duration.op, value: flat.duration.value });
	}

	if (children.length === 0) {
		return null;
	}
	if (children.length === 1) {
		return children[0];
	}
	return { op: 'and', children };
}

/** Player ids referenced in the AST (for row highlighting). */
export function playerIdsFromAst(ast: FilterAst | null | undefined): string[] {
	if (!ast) {
		return [];
	}

	const ids = new Set<string>();

	function walk(node: FilterAst) {
		if (isFilterLeaf(node)) {
			if (node.field === 'playerId') {
				if (node.op === 'eq') {
					ids.add(node.value);
				} else {
					for (const id of node.value) {
						ids.add(id);
					}
				}
			}
			return;
		}

		for (const child of node.children) {
			walk(child);
		}
	}

	walk(ast);
	return [...ids];
}

export function emptyFilterRule(leaf: FilterLeaf | null = null): FilterRule {
	return { id: newRuleId(), leaf };
}

export function defaultLeafForField(field: FilterField): FilterLeaf {
	switch (field) {
		case 'playerId':
			return { field: 'playerId', op: 'in', value: [] };
		case 'map':
			return { field: 'map', op: 'in', value: [] };
		case 'race':
			return { field: 'race', op: 'in', value: [] };
		case 'matchup':
			return { field: 'matchup', op: 'in', value: [] };
		case 'position':
			return { field: 'position', op: 'in', value: [] };
		case 'ranked':
			return { field: 'ranked', op: 'eq', value: true };
		case 'pro':
			return { field: 'pro', op: 'eq', value: true };
		case 'elo':
			return { field: 'elo', op: 'gt', value: 1800 };
		case 'duration':
			return { field: 'duration', op: 'gte', value: 20 };
	}
}
