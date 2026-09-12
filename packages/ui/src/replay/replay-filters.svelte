<script lang="ts">
	import { Button } from '@company-of-heroes/ui/button';
	import { Input, Select, Selection } from '@company-of-heroes/ui/input';
	import { ToggleGroup } from '@company-of-heroes/ui/toggle-group';
	import { cn } from '@company-of-heroes/ui/cn';
	import { interactive } from '@company-of-heroes/ui/variants';
	import XIcon from 'phosphor-svelte/lib/XIcon';
	import type { FilterOperator, HistoryMapOption, HistoryMatchup, ReplaysQuery } from './types';
	import {
		astToRules,
		defaultLeafForField,
		emptyFilterRule,
		flatFiltersToAst,
		isLeafComplete,
		playerIdsFromAst,
		rulesToAst,
		type FilterCombinator,
		type FilterField,
		type FilterLeaf,
		type FilterLeafOp,
		type FilterRule
	} from './filter-ast';

	type SelectOption = { value: string; label: string };

	type FilterLabels = {
		ranked: string;
		proGames: string;
		players: string;
		maps: string;
		faction: string;
		gameMode: string;
		position: string;
		elo: string;
		duration: string;
		selectPlayers: string;
		selectMaps: string;
		selectFactions: string;
		selectGameModes: string;
		selectPositions: string;
		changeOperator: string;
		minutes: string;
		clearFilters: string;
		apply: string;
		addCondition: string;
		and: string;
		or: string;
		contains: string;
		equals: string;
		is: string;
		removeCondition: string;
		trueLabel: string;
		falseLabel: string;
	};

	type Props = {
		query: ReplaysQuery;
		maps: HistoryMapOption[];
		onChange: (patch: Partial<ReplaysQuery>) => void;
		onSearchPlayers?: (query: string) => Promise<SelectOption[]>;
		onSearchMaps?: (query: string) => Promise<SelectOption[]>;
		labels?: Partial<FilterLabels>;
	};

	const defaultLabels: FilterLabels = {
		ranked: 'Ranked',
		proGames: 'Pro games',
		players: 'Players',
		maps: 'Maps',
		faction: 'Faction',
		gameMode: 'Game mode',
		position: 'Position',
		elo: 'ELO',
		duration: 'Duration',
		selectPlayers: 'Select players',
		selectMaps: 'Select maps',
		selectFactions: 'Select factions',
		selectGameModes: 'Select game modes',
		selectPositions: 'Select positions',
		changeOperator: 'Change operator',
		minutes: 'min',
		clearFilters: 'Clear filters',
		apply: 'Apply',
		addCondition: 'Add condition',
		and: 'And',
		or: 'Or',
		contains: 'Contains',
		equals: 'Equals',
		is: 'Is',
		removeCondition: 'Remove condition',
		trueLabel: 'True',
		falseLabel: 'False'
	};

	const MULTI_FIELDS = new Set<FilterField>(['playerId', 'map', 'race', 'matchup', 'position']);
	const BOOL_FIELDS = new Set<FilterField>(['ranked', 'pro']);
	const COMPARE_FIELDS = new Set<FilterField>(['elo', 'duration']);
	const FILTER_FIELDS: FilterField[] = [
		'playerId',
		'map',
		'race',
		'matchup',
		'position',
		'ranked',
		'pro',
		'elo',
		'duration'
	];
	const COMPARE_OPS: FilterOperator[] = ['gt', 'gte', 'lt', 'lte'];
	const operatorSymbol: Record<FilterOperator, string> = {
		gt: '>',
		gte: '≥',
		lt: '<',
		lte: '≤'
	};

	let { query, maps, onChange, onSearchPlayers, onSearchMaps, labels }: Props = $props();
	const l = $derived({ ...defaultLabels, ...labels });

	const factionOptions = [
		{ label: 'USA', value: '0' },
		{ label: 'Wehrmacht', value: '1' },
		{ label: 'Commonwealth', value: '2' },
		{ label: 'Panzer Elite', value: '3' }
	];
	const matchupOptions: { label: string; value: HistoryMatchup }[] = [
		{ label: '1v1', value: '1v1' },
		{ label: '2v2', value: '2v2' },
		{ label: '3v3', value: '3v3' },
		{ label: '4v4', value: '4v4' }
	];
	const positionOptions = ['1', '2', '3', '4', '5', '6', '7', '8'].map((value) => ({
		label: value,
		value
	}));

	function fieldLabel(field: FilterField): string {
		switch (field) {
			case 'playerId':
				return l.players;
			case 'map':
				return l.maps;
			case 'race':
				return l.faction;
			case 'matchup':
				return l.gameMode;
			case 'position':
				return l.position;
			case 'ranked':
				return l.ranked;
			case 'pro':
				return l.proGames;
			case 'elo':
				return l.elo;
			case 'duration':
				return l.duration;
		}
	}

	function rulesFromQuery(source: ReplaysQuery): FilterRule[] {
		if (source.filter != null) {
			return astToRules(source.filter);
		}

		const ast = flatFiltersToAst({
			ranked: source.ranked,
			pro: source.pro,
			playerIds: source.playerIds,
			maps: source.maps,
			races: source.races,
			matchups: source.matchups,
			positions: source.positions,
			elo: source.elo,
			duration: source.duration
		});
		return ast ? astToRules(ast) : [];
	}

	function appliedFilterKey(source: ReplaysQuery) {
		if (source.filter != null) {
			return JSON.stringify(source.filter);
		}

		const ast = flatFiltersToAst({
			ranked: source.ranked,
			pro: source.pro,
			playerIds: source.playerIds,
			maps: source.maps,
			races: source.races,
			matchups: source.matchups,
			positions: source.positions,
			elo: source.elo,
			duration: source.duration
		});
		return JSON.stringify(ast);
	}

	let localRules = $state<FilterRule[] | null>(null);
	let localKey = $state('');
	let playerLabels = $state<Record<string, string>>({});
	let mapLabels = $state<Record<string, string>>({});
	/** Raw compare drafts while typing; keyed by rule id. */
	let compareDrafts = $state<Record<string, string>>({});

	const queryKey = $derived(appliedFilterKey(query));
	const rules = $derived.by(() => {
		if (localRules != null && localKey === queryKey) {
			return localRules;
		}

		return rulesFromQuery(query);
	});

	const draftAst = $derived(rulesToAst(rules));
	const appliedAst = $derived.by(() => {
		if (query.filter != null) {
			return query.filter;
		}

		return flatFiltersToAst({
			ranked: query.ranked,
			pro: query.pro,
			playerIds: query.playerIds,
			maps: query.maps,
			races: query.races,
			matchups: query.matchups,
			positions: query.positions,
			elo: query.elo,
			duration: query.duration
		});
	});

	const isDirty = $derived(JSON.stringify(draftAst) !== JSON.stringify(appliedAst));
	const hasIncomplete = $derived(
		rules.some((rule) => {
			if (rule.leaf == null) {
				return false;
			}

			if (COMPARE_FIELDS.has(rule.leaf.field) && compareDrafts[rule.id] !== undefined) {
				const raw = compareDrafts[rule.id].trim();
				if (!raw) {
					return true;
				}

				const value = Number(raw.replace(/[^0-9]/g, ''));
				return !Number.isFinite(value);
			}

			return !isLeafComplete(rule.leaf);
		})
	);
	const canApply = $derived(isDirty && !hasIncomplete);
	const hasRules = $derived(rules.length > 0 || appliedAst != null);

	const mapCatalogOptions = $derived(
		maps.map((item) => ({ value: item.map, label: item.name || item.map }))
	);

	const joinItems = $derived([
		{ value: 'and', label: l.and },
		{ value: 'or', label: l.or }
	]);
	const fieldItems = $derived(
		FILTER_FIELDS.map((field) => ({ value: field, label: fieldLabel(field) }))
	);
	const multiOpItems = $derived([
		{ value: 'in', label: l.contains },
		{ value: 'eq', label: l.equals }
	]);
	const compareOpItems = $derived(
		COMPARE_OPS.map((op) => ({ value: op, label: operatorSymbol[op] }))
	);
	const boolIsItems = $derived([{ value: 'eq', label: l.is }]);
	const boolValueItems = $derived([
		{ value: 'true', label: l.trueLabel },
		{ value: 'false', label: l.falseLabel }
	]);

	function setRules(next: FilterRule[]) {
		localKey = queryKey;
		localRules = next;
	}

	function updateRule(id: string, patch: Partial<FilterRule>) {
		setRules(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
	}

	function updateLeaf(id: string, leaf: FilterLeaf) {
		updateRule(id, { leaf });
	}

	function removeRule(id: string) {
		const next = rules.filter((rule) => rule.id !== id);
		if (next.length > 0) {
			const [first, ...rest] = next;
			setRules([{ ...first, join: undefined }, ...rest]);
		} else {
			setRules([]);
		}

		const { [id]: _removed, ...restDrafts } = compareDrafts;
		compareDrafts = restDrafts;
	}

	function addCondition() {
		const leaf = defaultLeafForField('playerId');
		const rule = emptyFilterRule(leaf);
		if (rules.length > 0) {
			rule.join = 'and';
		}

		setRules([...rules, rule]);
	}

	function setField(id: string, field: FilterField) {
		const leaf = defaultLeafForField(field);
		updateLeaf(id, leaf);
		if (COMPARE_FIELDS.has(field)) {
			compareDrafts = { ...compareDrafts, [id]: String(leaf.value) };
		} else {
			const { [id]: _removed, ...rest } = compareDrafts;
			compareDrafts = rest;
		}
	}

	function setJoin(id: string, join: FilterCombinator) {
		updateRule(id, { join });
	}

	function setMultiOp(id: string, leaf: FilterLeaf, op: 'in' | 'eq') {
		if (!MULTI_FIELDS.has(leaf.field)) {
			return;
		}

		if (leaf.op === op) {
			return;
		}

		if (op === 'in') {
			const value = leaf.op === 'eq' ? (leaf.value ? [leaf.value] : []) : leaf.value;
			updateLeaf(id, { field: leaf.field, op: 'in', value } as FilterLeaf);
			return;
		}

		const first = leaf.op === 'in' ? (leaf.value[0] ?? '') : String(leaf.value ?? '');
		updateLeaf(id, { field: leaf.field, op: 'eq', value: first } as FilterLeaf);
	}

	function setCompareOp(id: string, leaf: FilterLeaf, op: FilterOperator) {
		if (leaf.field !== 'elo' && leaf.field !== 'duration') {
			return;
		}

		updateLeaf(id, { field: leaf.field, op, value: leaf.value });
	}

	function setCompareValue(id: string, leaf: FilterLeaf, raw: string) {
		if (leaf.field !== 'elo' && leaf.field !== 'duration') {
			return;
		}

		compareDrafts = { ...compareDrafts, [id]: raw };
		const trimmed = raw.trim();
		if (!trimmed) {
			updateLeaf(id, { field: leaf.field, op: leaf.op, value: Number.NaN });
			return;
		}

		const value = Number(trimmed.replace(/[^0-9]/g, ''));
		updateLeaf(id, {
			field: leaf.field,
			op: leaf.op,
			value: Number.isFinite(value) ? value : Number.NaN
		});
	}

	function compareDraftValue(rule: FilterRule): string {
		if (compareDrafts[rule.id] !== undefined) {
			return compareDrafts[rule.id];
		}

		if (rule.leaf && (rule.leaf.field === 'elo' || rule.leaf.field === 'duration')) {
			return Number.isFinite(rule.leaf.value) ? String(rule.leaf.value) : '';
		}

		return '';
	}

	function setBoolValue(id: string, leaf: FilterLeaf, value: boolean) {
		if (leaf.field !== 'ranked' && leaf.field !== 'pro') {
			return;
		}

		updateLeaf(id, { field: leaf.field, op: 'eq', value });
	}

	function setSelectionValue(id: string, leaf: FilterLeaf, next: string | string[]) {
		if (!MULTI_FIELDS.has(leaf.field)) {
			return;
		}

		if (leaf.op === 'in') {
			const value = Array.isArray(next) ? next : [next];
			updateLeaf(id, { field: leaf.field, op: 'in', value } as FilterLeaf);
			return;
		}

		const value = Array.isArray(next) ? (next[0] ?? '') : next;
		updateLeaf(id, { field: leaf.field, op: 'eq', value } as FilterLeaf);
	}

	function selectionOptions(leaf: FilterLeaf): SelectOption[] {
		switch (leaf.field) {
			case 'playerId': {
				const values = leaf.op === 'in' ? leaf.value : leaf.value ? [leaf.value] : [];
				return values.map((id) => ({
					value: id,
					label: playerLabels[id] || id
				}));
			}
			case 'map': {
				const values = leaf.op === 'in' ? leaf.value : leaf.value ? [leaf.value] : [];
				const byValue: Record<string, SelectOption> = {};
				for (const option of mapCatalogOptions) {
					byValue[option.value] = option;
				}
				for (const map of values) {
					if (!byValue[map]) {
						byValue[map] = { value: map, label: mapLabels[map] || map };
					}
				}
				return Object.values(byValue);
			}
			case 'race':
				return factionOptions;
			case 'matchup':
				return matchupOptions;
			case 'position':
				return positionOptions;
			default:
				return [];
		}
	}

	function selectionPlaceholder(field: FilterField): string {
		switch (field) {
			case 'playerId':
				return l.selectPlayers;
			case 'map':
				return l.selectMaps;
			case 'race':
				return l.selectFactions;
			case 'matchup':
				return l.selectGameModes;
			case 'position':
				return l.selectPositions;
			default:
				return '';
		}
	}

	function selectionValue(leaf: FilterLeaf): string | string[] {
		if (!MULTI_FIELDS.has(leaf.field)) {
			return [];
		}

		if (leaf.op === 'in') {
			return leaf.value as string[];
		}

		return (leaf.value as string) || '';
	}

	function rememberLabels(items: SelectOption[], target: 'players' | 'maps') {
		if (items.length === 0) {
			return;
		}

		const next = Object.fromEntries(items.map((item) => [item.value, item.label]));
		if (target === 'players') {
			playerLabels = { ...playerLabels, ...next };
			return;
		}

		mapLabels = { ...mapLabels, ...next };
	}

	async function searchPlayers(q: string) {
		if (!onSearchPlayers) {
			return [];
		}

		const results = await onSearchPlayers(q);
		rememberLabels(results, 'players');
		return results;
	}

	async function searchMaps(q: string) {
		if (!q.trim()) {
			return mapCatalogOptions;
		}

		if (onSearchMaps) {
			const results = await onSearchMaps(q);
			rememberLabels(results, 'maps');
			return results;
		}

		return mapCatalogOptions.filter((item) =>
			item.label.toLowerCase().includes(q.toLowerCase())
		);
	}

	function emptyFlatPatch() {
		return {
			ranked: false,
			pro: false,
			playerIds: [] as string[],
			maps: [] as string[],
			races: [] as string[],
			matchups: [] as HistoryMatchup[],
			positions: [] as string[],
			elo: null,
			duration: null
		};
	}

	function applyFilters() {
		const ast = rulesToAst(rules);
		onChange({
			...emptyFlatPatch(),
			filter: ast,
			playerIds: playerIdsFromAst(ast)
		});
	}

	function clearFilters() {
		setRules([]);
		compareDrafts = {};
		onChange({
			...emptyFlatPatch(),
			filter: null
		});
	}

	function opLabel(op: FilterLeafOp | FilterOperator): string {
		switch (op) {
			case 'in':
				return l.contains;
			case 'eq':
				return l.equals;
			case 'gt':
			case 'gte':
			case 'lt':
			case 'lte':
				return operatorSymbol[op];
			default:
				return String(op);
		}
	}
</script>

<div class="-m-4 flex flex-col">
	{#each rules as rule, index (rule.id)}
		{@const leaf = rule.leaf}
		{#if leaf}
			{#if index > 0}
				<div class="border-secondary-800 flex items-center justify-center border-b px-4 py-2">
					<ToggleGroup
						size="sm"
						value={rule.join ?? 'and'}
						items={joinItems}
						aria-label={`${l.and} / ${l.or}`}
						onValueChange={(next) => {
							if (typeof next === 'string' && next) {
								setJoin(rule.id, next as FilterCombinator);
							}
						}}
					/>
				</div>
			{/if}

			<div class="border-secondary-800 bg-gray-950 flex flex-col gap-2 border-b px-4 py-3">
				<div class="flex items-start gap-2">
					<div class="flex min-w-0 flex-1 flex-col gap-2">
						<div class="grid grid-cols-2 gap-2">
							<Select
								type="single"
								size="sm"
								value={leaf.field}
								items={fieldItems}
								aria-label={fieldLabel(leaf.field)}
								class="min-w-0 w-full"
								onValueChange={(next) => {
									if (typeof next === 'string') {
										setField(rule.id, next as FilterField);
									}
								}}
							/>

							{#if MULTI_FIELDS.has(leaf.field)}
								<Select
									type="single"
									size="sm"
									value={leaf.op}
									items={multiOpItems}
									aria-label={opLabel(leaf.op)}
									class="min-w-0 w-full"
									onValueChange={(next) => {
										if (typeof next === 'string') {
											setMultiOp(rule.id, leaf, next as 'in' | 'eq');
										}
									}}
								/>
							{:else if BOOL_FIELDS.has(leaf.field)}
								<Select
									type="single"
									size="sm"
									value="eq"
									items={boolIsItems}
									aria-label={l.is}
									disabled
									class="min-w-0 w-full"
								/>
							{:else if COMPARE_FIELDS.has(leaf.field)}
								<Select
									type="single"
									size="sm"
									value={leaf.op}
									items={compareOpItems}
									aria-label={l.changeOperator}
									class="min-w-0 w-full"
									onValueChange={(next) => {
										if (typeof next === 'string') {
											setCompareOp(rule.id, leaf, next as FilterOperator);
										}
									}}
								/>
							{/if}
						</div>

						{#if MULTI_FIELDS.has(leaf.field)}
							<Selection
								value={selectionValue(leaf)}
								options={selectionOptions(leaf)}
								multiple={leaf.op === 'in'}
								size="sm"
								class="w-full max-w-none min-w-0"
								placeholder={selectionPlaceholder(leaf.field)}
								onSearch={leaf.field === 'playerId'
									? searchPlayers
									: leaf.field === 'map'
										? searchMaps
										: undefined}
								onValueChange={(next) => setSelectionValue(rule.id, leaf, next)}
							/>
						{:else if BOOL_FIELDS.has(leaf.field)}
							<Select
								type="single"
								size="sm"
								value={leaf.value === true ? 'true' : 'false'}
								items={boolValueItems}
								aria-label={fieldLabel(leaf.field)}
								class="min-w-0 w-full"
								onValueChange={(next) => {
									if (typeof next === 'string') {
										setBoolValue(rule.id, leaf, next === 'true');
									}
								}}
							/>
						{:else if leaf.field === 'elo'}
							<Input
								value={compareDraftValue(rule)}
								size="sm"
								class="w-full"
								inputmode="numeric"
								autocomplete="off"
								spellcheck="false"
								oninput={(event) => setCompareValue(rule.id, leaf, event.currentTarget.value)}
							/>
						{:else if leaf.field === 'duration'}
							<Input
								value={compareDraftValue(rule)}
								size="sm"
								class="w-full"
								inputmode="numeric"
								autocomplete="off"
								spellcheck="false"
								oninput={(event) => setCompareValue(rule.id, leaf, event.currentTarget.value)}
							>
								{#snippet trailing()}
									<span class="text-secondary-400 text-xs">{l.minutes}</span>
								{/snippet}
							</Input>
						{/if}
					</div>

					<button
						type="button"
						class={cn(
							interactive,
							'text-secondary-400 hover:bg-secondary-800/50 hover:text-white shrink-0 rounded-md p-1.5'
						)}
						aria-label={l.removeCondition}
						onclick={() => removeRule(rule.id)}
					>
						<XIcon size={16} />
					</button>
				</div>
			</div>
		{/if}
	{/each}

	<div class="flex flex-wrap items-center gap-2 p-4">
		<Button type="button" variant="secondary" size="sm" onclick={addCondition}>
			+ {l.addCondition}
		</Button>
		<div class="ml-auto flex flex-wrap items-center gap-2">
			{#if hasRules}
				<Button type="button" variant="secondary" size="sm" onclick={clearFilters}>
					{l.clearFilters}
				</Button>
			{/if}
			<Button type="button" variant="primary" size="sm" disabled={!canApply} onclick={applyFilters}>
				{l.apply}
			</Button>
		</div>
	</div>
</div>
