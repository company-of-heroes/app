<script lang="ts">
	import { Input, Selection, Checkbox } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import type { ReplayList } from './replay-list.svelte';
	import { useI18n } from '$lib/i18n';

	type TriState = { value: boolean; indeterminate: boolean };

	type FiltersDraft = {
		query: string;
		players: string[];
		maps: string[];
		ranked: TriState;
		vp: TriState;
		highResources: TriState;
	};

	interface Props {
		list: ReplayList;
		mapsList: { value: string; label: string }[];
		playersList: { value: string; label: string }[];
	}

	let { list = $bindable(), mapsList, playersList }: Props = $props();
	const { t } = useI18n();

	const fieldLabelClass = 'text-secondary-400 text-xs font-semibold';
	const fieldClass = 'flex w-full flex-col gap-1.5';

	function emptyTriState(): TriState {
		return { value: false, indeterminate: false };
	}

	function emptyDraft(): FiltersDraft {
		return {
			query: '',
			players: [],
			maps: [],
			ranked: emptyTriState(),
			vp: emptyTriState(),
			highResources: emptyTriState()
		};
	}

	function draftFromFilters(source: ReplayList['filters']): FiltersDraft {
		return {
			query: source.query,
			players: [...source.players],
			maps: [...source.maps],
			ranked: { ...source.ranked },
			vp: { ...source.vp },
			highResources: { ...source.highResources }
		};
	}

	function appliedKey(source: ReplayList['filters']) {
		return JSON.stringify({
			query: source.query,
			players: source.players,
			maps: source.maps,
			ranked: source.ranked,
			vp: source.vp,
			highResources: source.highResources
		});
	}

	/** Local edits; when `localKey` matches applied filters, these override the snapshot. */
	let local = $state<FiltersDraft | null>(null);
	let localKey = $state('');

	const appliedKeyValue = $derived(appliedKey(list.filters));
	const draft = $derived.by(() => {
		if (local != null && localKey === appliedKeyValue) {
			return local;
		}

		return draftFromFilters(list.filters);
	});

	let ranked = $derived(draft.ranked);
	let vp = $derived(draft.vp);
	let highResources = $derived(draft.highResources);
	let query = $derived(draft.query);
	let players = $derived(draft.players);
	let maps = $derived(draft.maps);

	function setDraft(next: FiltersDraft) {
		localKey = appliedKeyValue;
		local = next;
	}

	function patchDraft(patch: Partial<FiltersDraft>) {
		setDraft({ ...draft, ...patch });
	}

	/** Match Checkbox setChecked tri-state cycle when indeterminate is bound. */
	function cycleTriState(current: TriState): TriState {
		if (current.indeterminate) {
			return { value: false, indeterminate: false };
		}

		if (current.value) {
			return { value: false, indeterminate: true };
		}

		return { value: true, indeterminate: false };
	}

	function sameTriState(a: TriState, b: TriState) {
		return a.value === b.value && a.indeterminate === b.indeterminate;
	}

	function sameStringArray(a: string[], b: string[]) {
		if (a.length !== b.length) {
			return false;
		}

		return a.every((value, index) => value === b[index]);
	}

	function hasFilters(values: FiltersDraft) {
		return (
			values.ranked.value ||
			values.ranked.indeterminate ||
			values.vp.value ||
			values.vp.indeterminate ||
			values.highResources.value ||
			values.highResources.indeterminate ||
			values.query.trim().length > 0 ||
			values.players.length > 0 ||
			values.maps.length > 0
		);
	}

	const isDirty = $derived(
		!sameTriState(ranked, list.filters.ranked) ||
			!sameTriState(vp, list.filters.vp) ||
			!sameTriState(highResources, list.filters.highResources) ||
			query !== list.filters.query ||
			!sameStringArray(players, list.filters.players) ||
			!sameStringArray(maps, list.filters.maps)
	);

	const hasActiveFilters = $derived(
		hasFilters(draft) || hasFilters(draftFromFilters(list.filters))
	);

	function applyToList(values: FiltersDraft) {
		list.filters.ranked = { ...values.ranked };
		list.filters.vp = { ...values.vp };
		list.filters.highResources = { ...values.highResources };
		list.filters.query = values.query;
		list.filters.players = [...values.players];
		list.filters.maps = [...values.maps];
	}

	function applyFilters() {
		applyToList(draft);
	}

	function clearFilters() {
		const empty = emptyDraft();
		setDraft(empty);
		applyToList(empty);
	}
</script>

<div class="flex flex-col gap-4">
	<div class={fieldClass}>
		<Checkbox
			size="sm"
			label={t('Ranked only')}
			checked={ranked.value}
			indeterminate={ranked.indeterminate}
			onCheckedChange={() => patchDraft({ ranked: cycleTriState(ranked) })}
		/>
	</div>
	<div class={fieldClass}>
		<Checkbox
			size="sm"
			label={t('Victory Points')}
			checked={vp.value}
			indeterminate={vp.indeterminate}
			onCheckedChange={() => patchDraft({ vp: cycleTriState(vp) })}
		/>
	</div>
	<div class={fieldClass}>
		<Checkbox
			size="sm"
			label={t('High Resources')}
			checked={highResources.value}
			indeterminate={highResources.indeterminate}
			onCheckedChange={() => patchDraft({ highResources: cycleTriState(highResources) })}
		/>
	</div>
	<div class={fieldClass}>
		<span class={fieldLabelClass}>{t('Title')}</span>
		<Input
			size="sm"
			class="w-full"
			placeholder={t('Enter title')}
			value={query}
			aria-label={t('Title')}
			oninput={(e) => patchDraft({ query: e.currentTarget.value })}
		/>
	</div>
	<div class={fieldClass}>
		<span class={fieldLabelClass}>{t('Players')}</span>
		<Selection
			options={playersList}
			placeholder={t('Select players')}
			multiple
			size="sm"
			class="w-full max-w-none min-w-0"
			value={players}
			onValueChange={(next) =>
				patchDraft({ players: Array.isArray(next) ? next : [next] })}
		/>
	</div>
	<div class={fieldClass}>
		<span class={fieldLabelClass}>{t('Maps')}</span>
		<Selection
			options={mapsList}
			placeholder={t('Select maps')}
			multiple
			size="sm"
			class="w-full max-w-none min-w-0"
			value={maps}
			onValueChange={(next) => patchDraft({ maps: Array.isArray(next) ? next : [next] })}
		/>
	</div>
	<div class="flex flex-wrap items-center justify-end gap-2">
		{#if hasActiveFilters}
			<Button type="button" variant="secondary" size="sm" onclick={clearFilters}>
				{t('Clear filters')}
			</Button>
		{/if}
		<Button type="button" variant="primary" size="sm" disabled={!isDirty} onclick={applyFilters}>
			{t('Apply')}
		</Button>
	</div>
</div>
