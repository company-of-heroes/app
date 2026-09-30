import { okAsync, ResultAsync } from 'neverthrow';
import { all, fromPb, sequence, type Task } from '../result';
import { Service } from './service';

const SEED_EMAIL = (index: number) => `dev-live-lobby-${index}@fknoobs.com`;
const SEED_SESSION_BASE = 900_100_000;
const SEED_COUNT = 5;
const RANKED_TITLES = ['1 VS. 1', '2 VS. 2', '3 VS. 3', '4 VS. 4'];

type SourceLobby = { id: string; title: string; map: string; isRanked: boolean; players: unknown };

/**
 * Local development only: fills the live lobby list from recent real ranked
 * matches (one per team size first), each hosted by its own seed account.
 */
export class DevSeedService extends Service {
	private seedUser(index: number, name: string): Task<string> {
		const users = this.pb.collection('users');
		const email = SEED_EMAIL(index);
		return fromPb(
			users.getList<{ id: string }>(1, 1, {
				filter: this.pb.filter('email = {:email}', { email }),
				skipTotal: true
			}),
			'Could not load users'
		).andThen((existing) => {
			const user = existing.items[0];
			if (user) {
				return fromPb(users.update(user.id, { name }), 'Could not update seed user').map(
					() => user.id
				);
			}

			const password = 'DevLiveLobbySeed1!';
			return fromPb(
				users.create<{ id: string }>({
					email,
					password,
					passwordConfirm: password,
					name,
					verified: true
				}),
				'Could not create seed user'
			).map((created) => created.id);
		});
	}

	/** One lobby per team size first, then the most recent others. */
	private pickLobbies(): Task<SourceLobby[]> {
		return fromPb(
			this.pb.collection('lobbies').getList<SourceLobby>(1, 60, {
				filter: `isRanked = true && (${RANKED_TITLES.map((title) => this.pb.filter('title = {:title}', { title })).join(' || ')})`,
				sort: '-createdAt',
				fields: 'id,title,map,isRanked,players'
			}),
			'Could not load matches'
		).map((recent) => {
			const byTitle = RANKED_TITLES.flatMap((title) =>
				recent.items.filter((lobby) => lobby.title === title).slice(0, 1)
			);
			return [...byTitle, ...recent.items.filter((lobby) => !byTitle.includes(lobby))].slice(
				0,
				SEED_COUNT
			);
		});
	}

	seed(): Task<{ seeded: { id: string; from: string }[] }> {
		return this.pickLobbies()
			.andThen((picked) =>
				sequence(picked, (lobby, i) => {
					const players = Array.isArray(lobby.players)
						? (lobby.players as Record<string, unknown>[])
						: [];
					const host = String(
						(players[0]?.profile as { alias?: string } | undefined)?.alias ?? `Dev lobby ${i + 1}`
					);
					return this.seedUser(i + 1, host)
						.andThen((userId) =>
							this.services.liveLobbies.publish(userId, {
								sessionId: SEED_SESSION_BASE + i + 1,
								isRanked: true,
								map: lobby.map,
								players,
								matchType: RANKED_TITLES.indexOf(lobby.title) + 1,
								isReplay: false
							})
						)
						.map((row) => ({ id: row.id, from: lobby.id }));
				})
			)
			.map((seeded) => ({ seeded }));
	}

	clear(): Task<{ removed: number }> {
		const filter = `sessionId > ${SEED_SESSION_BASE} && sessionId <= ${SEED_SESSION_BASE + SEED_COUNT}`;
		const live = this.pb.collection('lobbies_live');
		const lobbies = this.pb.collection('lobbies');
		return ResultAsync.combine([
			fromPb(
				live.getFullList<{ id: string }>({ filter, fields: 'id' }),
				'Could not load live lobbies'
			),
			fromPb(
				lobbies.getFullList<{ id: string }>({ filter, fields: 'id' }),
				'Could not load matches'
			)
		]).andThen(([rows, matches]) =>
			all([
				...rows.map((row) => fromPb(live.delete(row.id), 'Could not remove live lobby')),
				...matches.map((row) => fromPb(lobbies.delete(row.id), 'Could not remove match')),
				okAsync(true)
			]).map(() => ({ removed: rows.length }))
		);
	}
}
