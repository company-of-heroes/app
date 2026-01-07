<script lang="ts">
	import type {
		LobbyAggregationCommunityResponse,
		LobbyAggregationResponse,
		UsersResponse
	} from '$core/pocketbase/types';
	import type { LobbyPlayer } from '@fknoobs/app';
	import type { Snapshot } from './$types';
	import { app } from '$core/context';
	import { H } from '$lib/components/ui/h';
	import { normalizeMapName } from '$lib/utils';
	import { resource } from 'runed';
	import { uniqBy, uniq } from 'lodash-es';
	import { MatchList, type MatchListState } from './match-list.svelte';
	import MatchFilters from './match-filters.svelte';
	import MatchTable from './match-table.svelte';
	import { pocketbase } from '$core/pocketbase';

	let list = $state(new MatchList());

	$effect(() => {
		if (list.matches.length === 0) {
			list.loadMore();
		}
	});

	const aggregation = resource(
		() => list.filters.scope,
		async () => {
			const response = await app.pocketbase
				.collection(
					list.filters.scope === 'user' ? 'lobby_aggregation' : 'lobby_aggregation_community'
				)
				.getFullList<
					| LobbyAggregationResponse<string[], LobbyPlayer[]>
					| LobbyAggregationCommunityResponse<string[], LobbyPlayer[], string[]>
				>({
					filter: list.filters.scope === 'user' ? `user = "${app.features.auth.userId}"` : undefined
				});

			let users: UsersResponse<Record<string, any>, string[]>[] = [];

			if (list.filters.scope === 'community' && 'users' in response[0]) {
				const userIds = response[0].users as string[];
				try {
					const pocketbaseUsers = await pocketbase
						.collection('users')
						.getFullList<UsersResponse<Record<string, any>, string[]>>({
							filter: `id = "${userIds.join('" || id = "')}"`
						});
					users = pocketbaseUsers;
				} catch (error) {
					console.error('Error fetching users:', error);
				}
			}

			if (response.length === 0) {
				return { players: [], maps: [], users: [] };
			}

			return {
				players: uniqBy(response[0].players, 'profile.alias').filter((p) => p.profile),
				maps: uniq(response[0].maps),
				users: uniqBy(users, 'id')
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

	const usersList = $derived(
		aggregation.current?.users.map((u) => ({
			value: u.id,
			label: u.name
		})) || []
	);

	export const snapshot: Snapshot<MatchListState> = {
		capture: () => list.capture(),
		restore: (value) => {
			list.restore(value);
		}
	};
</script>

<H level="1">Match History</H>

<MatchFilters {list} {mapsList} {playersList} {usersList} />
<MatchTable {list} />
