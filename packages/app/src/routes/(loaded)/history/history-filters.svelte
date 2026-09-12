<script lang="ts">
	import { Filters } from '@company-of-heroes/ui/replay';
	import type { HistoryMapOption, HistoryMatchup, ReplaysQuery } from '@company-of-heroes/ui/replay';
	import type { Matches } from '$core/app/features/history/matches.svelte';
	import { useI18n } from '$lib/i18n';

	interface Props {
		matches: Matches;
	}

	let { matches }: Props = $props();
	const { t } = useI18n();

	const labels = $derived({
		ranked: t('Ranked'),
		proGames: t('Pro games'),
		players: t('Players'),
		maps: t('Maps'),
		faction: t('Faction'),
		gameMode: t('Game mode'),
		position: t('Position'),
		elo: t('ELO'),
		duration: t('Duration'),
		selectPlayers: t('Select players'),
		selectMaps: t('Select maps'),
		selectFactions: t('Select factions'),
		selectGameModes: t('Select game modes'),
		selectPositions: t('Select positions'),
		changeOperator: t('Change operator'),
		minutes: t('min'),
		clearFilters: t('Clear filters'),
		apply: t('Apply'),
		addCondition: t('Add condition'),
		and: t('And'),
		or: t('Or'),
		contains: t('Contains'),
		equals: t('Equals'),
		is: t('Is'),
		removeCondition: t('Remove condition'),
		trueLabel: t('True'),
		falseLabel: t('False')
	});

	const query = $derived.by((): ReplaysQuery => ({
		page: matches.page,
		ranked: matches.filters.ranked,
		pro: matches.filters.pro,
		matchups: matches.filters.matchups as HistoryMatchup[],
		playerIds: matches.filters.playerIds,
		maps: matches.filters.maps,
		races: matches.filters.races,
		positions: matches.filters.positions,
		elo: matches.filters.elo ?? null,
		duration: matches.filters.duration ?? null,
		filter: matches.filters.filter ?? null,
		sort: matches.sort,
		sortDir: matches.sortDir
	}));

	const maps = $derived.by(
		(): HistoryMapOption[] =>
			matches.mapOptions.map((option) => ({
				map: option.value,
				name: option.label
			}))
	);

	function onChange(patch: Partial<ReplaysQuery>) {
		if (patch.ranked !== undefined) {
			matches.filters.ranked = patch.ranked;
		}
		if (patch.pro !== undefined) {
			matches.filters.pro = patch.pro;
		}
		if (patch.playerIds !== undefined) {
			matches.filters.playerIds = patch.playerIds;
		}
		if (patch.maps !== undefined) {
			matches.filters.maps = patch.maps;
		}
		if (patch.races !== undefined) {
			matches.filters.races = patch.races;
		}
		if (patch.matchups !== undefined) {
			matches.filters.matchups = patch.matchups;
		}
		if (patch.positions !== undefined) {
			matches.filters.positions = patch.positions;
		}
		if (patch.elo !== undefined) {
			matches.filters.elo = patch.elo ?? undefined;
		}
		if (patch.duration !== undefined) {
			matches.filters.duration = patch.duration ?? undefined;
		}
		if (patch.filter !== undefined) {
			matches.filters.filter = patch.filter ?? undefined;
		}
	}
</script>

<Filters
	{query}
	{maps}
	{onChange}
	{labels}
	onSearchPlayers={(q) => matches.searchPlayers(q)}
	onSearchMaps={(q) => matches.searchMaps(q)}
/>
