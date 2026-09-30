import { ok, okAsync } from 'neverthrow';
import { mergedProfile, pickKeeper, steamIdsOf, uniquePeers, type UserRow } from '../domain/users';
import { fromPb, sequence, type Task } from '../result';
import { Service } from './service';

/** A field somewhere that points at a user, found from the schema (never a hand-kept list). */
type UserRelation = { collection: string; field: string; multiple: boolean; peers: string[][] };
type Row = Record<string, unknown> & { id: string };
type MergeResult =
	| { merged: false; keeperId?: undefined; loserIds?: undefined }
	| { merged: boolean; keeperId: string; loserIds: string[] };

const USERS = '_pb_users_auth_';
/**
 * Accounts: merging duplicates (several `users` rows with one Steam id) and the
 * anti-cheat labels that follow a user's Steam ids.
 */
export class UsersService extends Service {
	#relations?: UserRelation[];

	/** Every relation field to `users` in a base collection, with its unique-index peers. */
	private userRelations(): Task<UserRelation[]> {
		if (this.#relations) {
			return okAsync(this.#relations);
		}

		return fromPb(
			this.pb.collections.getFullList<{
				name: string;
				type: string;
				indexes: string[];
				fields: { name: string; type: string; collectionId?: string; maxSelect?: number }[];
			}>(),
			'Could not load collections'
		).map((collections) => {
			this.#relations = collections
				.filter((collection) => collection.type === 'base')
				.flatMap((collection) =>
					collection.fields
						.filter((field) => field.type === 'relation' && field.collectionId === USERS)
						.map((field) => ({
							collection: collection.name,
							field: field.name,
							multiple: (field.maxSelect ?? 1) > 1,
							peers: uniquePeers(collection.indexes ?? [], field.name)
						}))
				);
			return this.#relations;
		});
	}

	/** Would the keeper already have this row (by a unique index)? Loser ids among the peers count as the keeper. */
	private keeperHasTwin(
		relation: UserRelation,
		row: Row,
		loserId: string,
		keeperId: string
	): Task<boolean> {
		return sequence(relation.peers, (peers) => {
			const conditions = [
				this.pb.filter(`${relation.field} = {:keeper}`, { keeper: keeperId }),
				...peers.map((peer) =>
					this.pb.filter(`${peer} = {:value}`, {
						value: row[peer] === loserId ? keeperId : row[peer]
					})
				)
			];
			return fromPb(
				this.pb
					.collection(relation.collection)
					.getList(1, 1, { filter: conditions.join(' && '), fields: 'id', skipTotal: true }),
				'Could not load rows'
			).map((twin) => twin.items.length > 0);
		}).map((twins) => twins.some(Boolean));
	}

	/** Moves one row from the loser to the keeper (or drops it when the keeper has its twin). */
	private moveRow(relation: UserRelation, row: Row, loserId: string, keeperId: string) {
		const collection = this.pb.collection(relation.collection);
		if (relation.multiple) {
			const ids = (row[relation.field] as string[]).map((id) => (id === loserId ? keeperId : id));
			return fromPb(collection.update(row.id, { [relation.field]: [...new Set(ids)] }));
		}

		return this.keeperHasTwin(relation, row, loserId, keeperId).andThen((twin) =>
			twin
				? fromPb(collection.delete(row.id))
				: fromPb(collection.update(row.id, { [relation.field]: keeperId }))
		);
	}

	/** Moves one relation's rows; returns how many could not be moved. */
	private moveRelation(relation: UserRelation, loserId: string, keeperId: string): Task<number> {
		return fromPb(
			this.pb.collection(relation.collection).getFullList<Row>({
				filter: this.pb.filter(`${relation.field} ${relation.multiple ? '?=' : '='} {:loser}`, {
					loser: loserId
				})
			}),
			'Could not load rows'
		).andThen((rows) =>
			sequence(rows, (row) =>
				this.moveRow(relation, row, loserId, keeperId)
					.map(() => 0)
					.orElse((error) => {
						console.warn('[users] merge: could not move', relation.collection, row.id, error);
						return ok(1);
					})
			).map((failures) => failures.reduce((sum, failed) => sum + failed, 0))
		);
	}

	/** Moves everything that points at the loser to the keeper; returns how many rows could not be moved. */
	private moveRows(loserId: string, keeperId: string): Task<number> {
		return this.userRelations()
			.andThen((relations) =>
				sequence(relations, (relation) => this.moveRelation(relation, loserId, keeperId))
			)
			.map((failures) => failures.reduce((sum, failed) => sum + failed, 0));
	}

	/** Uploads the same replay twice (title, file name and game date) keep the newest. */
	private dedupeReplays(userId: string): Task<void> {
		return fromPb(
			this.pb
				.collection('replays')
				.getFullList<{ id: string; title: string; filename: string; gameDate: string }>({
					filter: this.pb.filter('createdBy = {:userId}', { userId }),
					fields: 'id,title,filename,gameDate,createdAt',
					sort: '-createdAt'
				}),
			'Could not load replays'
		)
			.andThen((rows) => {
				const seen = new Set<string>();
				const duplicates = rows.filter((row) => {
					const key = `${row.title}||${row.filename}||${row.gameDate}`;
					const duplicate = seen.has(key);
					seen.add(key);
					return duplicate;
				});
				return sequence(duplicates, (row) =>
					fromPb(this.pb.collection('replays').delete(row.id), 'Could not delete replay')
				);
			})
			.map(() => undefined);
	}

	/** Staff labelled the user a cheater: the label covers every Steam id on the account. */
	syncCheaterLabels(userId: string): Task<void> {
		const cheaters = this.pb.collection('anti_cheat_cheaters');
		return fromPb(
			cheaters.getFullList<{ steam_id: string; labeled_by: string }>({
				filter: this.pb.filter('user = {:userId}', { userId })
			}),
			'Could not load anti-cheat labels'
		).andThen((labels) => {
			if (labels.length === 0) {
				return okAsync(undefined);
			}

			const labelled = new Set(labels.map((label) => label.steam_id));
			const labeledBy = labels.find((label) => label.labeled_by)?.labeled_by;
			return fromPb(
				this.pb.collection('users').getOne<UserRow>(userId, { fields: 'steamIds' }),
				'User not found'
			)
				.andThen((user) =>
					sequence(
						steamIdsOf(user).filter((id) => !labelled.has(id)),
						(steamId) =>
							fromPb(
								cheaters.create({
									user: userId,
									steam_id: steamId,
									...(labeledBy ? { labeled_by: labeledBy } : {})
								}),
								'Could not save anti-cheat label'
							)
					)
				)
				.map(() => undefined);
		});
	}

	/** Users sharing any Steam id with the given ones, followed transitively. */
	private accountGroup(
		next: string[],
		searched = new Set<string>(),
		users = new Map<string, UserRow>()
	): Task<UserRow[]> {
		const pending = [...new Set(next)].filter((steamId) => !searched.has(steamId));
		if (pending.length === 0) {
			return okAsync([...users.values()]);
		}

		pending.forEach((steamId) => searched.add(steamId));
		return fromPb(
			this.pb.collection('users').getFullList<UserRow>({
				filter: pending
					.map((steamId) => this.pb.filter('steamIds ~ {:steamId}', { steamId: `"${steamId}"` }))
					.join(' || '),
				fields: 'id,name,role,steamIds,meta,lastLogin,created'
			}),
			'Could not load users'
		).andThen((found) => {
			found.forEach((user) => users.set(user.id, user));
			return this.accountGroup(found.flatMap(steamIdsOf), searched, users);
		});
	}

	/**
	 * Merges the accounts into one keeper (`preferId`, else the most recently used).
	 * A loser is only deleted once all of its rows moved; a failed run is retried by the job.
	 */
	merge(users: UserRow[], preferId?: string): Task<MergeResult> {
		if (users.length < 2) {
			return okAsync({ merged: false });
		}

		const keeper = pickKeeper(users, preferId);
		const losers = users.filter((user) => user.id !== keeper.id);
		return sequence(losers, (loser) =>
			this.moveRows(loser.id, keeper.id).map((failed) => (failed === 0 ? loser.id : ''))
		)
			.map((ids) => ids.filter(Boolean))
			.andThen((deleted) =>
				fromPb(
					this.pb.collection('users').update(keeper.id, mergedProfile(keeper, users)),
					'Could not update the merged account'
				)
					.andThen(() =>
						sequence(deleted, (id) =>
							fromPb(this.pb.collection('users').delete(id), 'Could not delete a merged account')
						)
					)
					.andThen(() => this.dedupeReplays(keeper.id))
					.andThen(() => this.services.reputation.refreshUserTotal(keeper.id))
					.andThen(() => this.syncCheaterLabels(keeper.id))
					.map(
						(): MergeResult => ({
							merged: deleted.length > 0,
							keeperId: keeper.id,
							loserIds: deleted
						})
					)
			);
	}

	/** After a user's Steam ids changed: merge with every other account using them. */
	mergeFor(userId: string): Task<MergeResult> {
		return fromPb(
			this.pb.collection('users').getOne<UserRow>(userId, { fields: 'steamIds' }),
			'User not found'
		)
			.andThen((user) => this.accountGroup(steamIdsOf(user)))
			.andThen((group) => this.merge(group, userId));
	}

	/** Scheduled: one group of accounts sharing a Steam id (older apps edit steamIds directly). */
	mergeDuplicates(): Task<{ processed: number; more: boolean }> {
		return fromPb(
			this.pb
				.collection('user_steam_duplicates')
				.getList<{ id: string }>(1, 1, { skipTotal: true }),
			'Could not load duplicate accounts'
		).andThen((rows) => {
			const duplicate = rows.items[0];
			if (!duplicate) {
				return okAsync({ processed: 0, more: false });
			}

			return this.accountGroup([duplicate.id])
				.andThen((group) => this.merge(group))
				.map((result) => ({ processed: result.merged ? 1 : 0, more: result.merged }));
		});
	}
}
