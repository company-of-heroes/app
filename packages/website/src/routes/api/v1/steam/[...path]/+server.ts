import { err, ok } from 'neverthrow';
import { cached } from '$lib/server/cache';
import { badRequest, notFound } from '$lib/server/errors';
import { handle, requireUser } from '$lib/server/http';

/** The Steam Web API calls the desktop app makes, with the parameters each may send. */
const ENDPOINTS: Record<string, Record<string, RegExp>> = {
	'ISteamUser/GetPlayerSummaries/v2': { steamids: /^\d{17}(,\d{17}){0,99}$/ },
	'IPlayerService/GetRecentlyPlayedGames/v1': { steamid: /^\d{17}$/, count: /^\d{1,3}$/ },
	'ISteamUserStats/GetNumberOfCurrentPlayers/v1': { appid: /^\d{1,10}$/ }
};

/** Steam Web API proxy for the desktop app: the key stays on the server. */
export const GET = handle((event) =>
	requireUser(event)
		.andThen(() => {
			const path = (event.params.path ?? '').replace(/\/+$/, '');
			const allowed = ENDPOINTS[path];
			if (!allowed) {
				return err(notFound('Unknown Steam endpoint'));
			}

			const params: Record<string, string> = {};
			for (const [name, pattern] of Object.entries(allowed)) {
				const value = event.url.searchParams.get(name);
				if (value === null) {
					continue;
				}

				if (!pattern.test(value)) {
					return err(badRequest(`Invalid ${name}`));
				}

				params[name] = value;
			}

			return ok({ path, params });
		})
		.asyncAndThen(({ path, params }) =>
			cached(`steam:${path}:${new URLSearchParams(params)}`, 300, () =>
				event.locals.services.clients.steam.call(path, params)
			)
		)
);
