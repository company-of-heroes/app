import type { MatchesResponse, UsersResponse } from '$core/pocketbase/types';
import type { LobbyPlayer, Match as MatchLobby, Expand } from '@fknoobs/app';
import { fetch } from '@tauri-apps/plugin-http';
import { useQuery } from '../cache';
import { app } from '../context';
import type { ListResult } from 'pocketbase';

export type GetMatchHistoryOptions = {
	forceRefresh?: boolean;
	page?: number;
	perPage?: number;
};

export type Match = MatchesResponse<
	LobbyPlayer[],
	MatchLobby | null,
	{
		user: UsersResponse<Record<string, any>, string[]>;
	}
> & { players: LobbyPlayer[] };
export type MatchExpanded = Expand<Match>;

export class Matches2 {
	getMatchHistoryBySteamIds(steamIds: string[], options?: GetMatchHistoryOptions) {
		const sortedIds = [...steamIds].sort();
		const key =
			'match-history-' +
			sortedIds.join('-') +
			(options?.page ? `-p${options.page}` : '') +
			(options?.perPage ? `-pp${options.perPage}` : '');

		return useQuery(key, {
			invalidate: options?.forceRefresh,
			queryFn: async (): Promise<ListResult<Match>> => {
				const matches = await app.pocketbase
					.collection('matches')
					.getList<Match>(options?.page, options?.perPage, {
						filter: `${steamIds.map((id) => `players ~ "${id}"`).join(' || ')}`,
						sort: '-createdAt',
						expand: 'user',
						fetch
					});

				return matches;
			},
			invalidateFn: async (value) => {
				console.log(value);

				return false;
			}
		});
	}
}
