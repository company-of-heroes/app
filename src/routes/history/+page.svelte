<script lang="ts">
	import type { LobbiesResponse, LobbyPlayersResponse } from '$core/pocketbase/types';
	import type { LobbyPlayer, Match as MatchResult } from '@fknoobs/app';
	import * as Form from '$lib/components/ui/form';
	import * as Match from '$lib/components/match';
	import { app } from '$core/app';
	import { tooltip } from '$lib/attachments';
	import { H } from '$lib/components/ui/h';
	import { Table, TD, TH, THead, TR } from '$lib/components/ui/table';
	import { cn, getFactionFlagFromRace, getRacePrefix, normalizeMapName } from '$lib/utils';
	import { resource, watch, Debounced } from 'runed';
	import { uniqBy, uniq } from 'lodash-es';
	import { Checkbox, Input, Selection } from '$lib/components/ui/input';

	const PAGE_SIZE = 50;
	const FILTER_DEBOUNCE_MS = 300;

	type FiltersState = {
		query: string;
		ranked: { value: boolean; indeterminate: boolean };
		players: string[];
		maps: string[];
	};

	function escapePocketBaseString(value: string) {
		return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
	}

	function buildPocketBaseFilter(filters: FiltersState) {
		const parts: string[] = [`user = "${app.features.auth.userId}"`];

		const query = filters.query.trim();
		if (query) {
			const q = escapePocketBaseString(query);
			parts.push(`(title ~ "${q}" || result.description ~ "${q}")`);
		}

		// tri-state:
		// - checked => ranked only
		// - indeterminate => unranked only
		// - neither => all
		if (filters.ranked.value) {
			parts.push('isRanked = true');
		} else if (filters.ranked.indeterminate) {
			parts.push('isRanked = false');
		}

		if (filters.maps.length > 0) {
			const mapExpr = filters.maps.map((m) => `map = "${escapePocketBaseString(m)}"`).join(' || ');
			parts.push(`(${mapExpr})`);
		}

		if (filters.players.length > 0) {
			const playerExpr = filters.players
				.map((p) => `players ~ "${escapePocketBaseString(p)}"`)
				.join(' || ');
			parts.push(`(${playerExpr})`);
		}

		return parts.join(' && ');
	}

	let filters = $state<FiltersState>({
		query: '',
		ranked: { value: false, indeterminate: false },
		players: [],
		maps: []
	});

	let lobbies = $state<LobbiesResponse<LobbyPlayer[], MatchResult | null>[]>([]);
	let page = $state(1);
	let hasMore = $state(true);
	let isLoading = $state(false);

	// Used to ignore stale async results when filters change mid-request.
	let searchId = 0;
	let activeFilter = $state(buildPocketBaseFilter($state.snapshot(filters)));

	const debouncedFilter = new Debounced(
		() => buildPocketBaseFilter($state.snapshot(filters)),
		FILTER_DEBOUNCE_MS
	);

	function resetSearch(nextFilter: string) {
		searchId += 1;
		activeFilter = nextFilter;
	}

	async function loadMore({ reset = false }: { reset?: boolean } = {}) {
		if (isLoading) return;
		if (!hasMore && !reset) return;

		isLoading = true;
		const currentSearchId = searchId;

		if (reset) {
			page = 1;
			hasMore = true;
			lobbies = [];
		}

		try {
			const result = await app.pocketbase
				.collection('lobbies')
				.getList<LobbiesResponse<LobbyPlayer[], MatchResult | null>>(page, PAGE_SIZE, {
					filter: activeFilter,
					sort: '-createdAt'
				});

			if (currentSearchId !== searchId) {
				return;
			}

			lobbies = [...lobbies, ...result.items];

			page += 1;
			hasMore = result.page < result.totalPages;
		} catch (e) {
			console.error(e);
		} finally {
			if (currentSearchId === searchId) {
				isLoading = false;
			}
		}
	}

	watch(
		() => debouncedFilter.current,
		(nextFilter) => {
			resetSearch(nextFilter);
			loadMore({ reset: true });
		}
	);

	function viewport(node: HTMLElement) {
		const observer = new IntersectionObserver((entries) => {
			if (!entries[0]?.isIntersecting) return;
			if (isLoading || !hasMore) return;
			loadMore();
		});

		observer.observe(node);

		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	const aggregation = resource(
		() => null,
		async () => {
			const response = await app.pocketbase
				.collection('lobby_players')
				.getFullList<LobbyPlayersResponse<string[], LobbyPlayer[]>>();

			if (response.length === 0) {
				return { players: [], maps: [] };
			}

			return {
				players: uniqBy(response[0].players, 'profile.alias').filter((p) => p.profile),
				maps: uniq(response[0].maps)
			};
		}
	);

	const mapsList = $derived(
		aggregation.current?.maps.map((m) => ({
			value: m,
			label: normalizeMapName(m)
		})) || []
	);

	const playersList = $derived(
		aggregation.current?.players.map((p) => ({
			value: p.profile!.alias,
			label: p.profile!.alias
		})) || []
	);
</script>

<H level="1">Match History</H>

<Form.Root class="border-secondary-800 mb-4 border-b pb-4">
	<Form.Group>
		<Checkbox
			label="Only ranked games"
			bind:checked={filters.ranked.value}
			bind:indeterminate={filters.ranked.indeterminate}
		/>
	</Form.Group>

	<Form.Group>
		<Form.Label>Filter players</Form.Label>
		<Selection
			options={playersList}
			placeholder="Select players..."
			multiple
			bind:value={filters.players}
		/>
	</Form.Group>

	<div class="grid grid-cols-[250px_1fr] gap-4">
		<Form.Group>
			<Form.Label>Title</Form.Label>
			<Input placeholder="Enter title" bind:value={filters.query} />
		</Form.Group>

		<Form.Group>
			<Form.Label>Filter map(s)</Form.Label>
			<Selection
				options={mapsList}
				placeholder="Select maps..."
				multiple
				bind:value={filters.maps}
			/>
		</Form.Group>
	</div>
</Form.Root>

<Table>
	<THead>
		<TH width="5/24">Map</TH>
		<TH width="5/24">Title</TH>
		<TH width="3/24">Allies</TH>
		<TH width="3/24">Axis</TH>
		<TH width="2/24"></TH>
		<TH width="4/24">Date</TH>
		<TH width="2/24"></TH>
	</THead>

	{#if lobbies.length > 0}
		{#each lobbies as match (match.id)}
			<Match.Root {match}>
				<TR class="text-gray-200" href={`/history/${match.id}`}>
					<TD width="5/24" class="flex items-center">
						<Match.MapImage />
						<Match.MapName />
					</TD>

					<TD width="5/24">
						<Match.Title />
					</TD>

					<TD width="3/24">
						<Match.Players team="allies" />
					</TD>

					<TD width="3/24">
						<Match.Players team="axis" />
					</TD>

					<TD width="2/24">
						<Match.Rating />
					</TD>

					<TD width="4/24">
						<Match.Date />
					</TD>

					<TD width="2/24">
						<Match.Status />
					</TD>
				</TR>
			</Match.Root>
		{/each}

		{#if hasMore}
			<div use:viewport class="border-secondary-800 w-full border-t px-4 py-2">
				<small>
					Showing {lobbies.length} matches
					{#if isLoading}
						(loading...)
					{/if}
				</small>
			</div>
		{:else}
			<div class="border-secondary-800 w-full border-t px-4 py-2">
				<small>Showing {lobbies.length} matches</small>
			</div>
		{/if}
	{:else}
		<div class="border-secondary-800 w-full border-t px-4 py-2">
			<small>
				{#if isLoading}
					Loading matches...
				{:else}
					No matches found.
				{/if}
			</small>
		</div>
	{/if}
</Table>
