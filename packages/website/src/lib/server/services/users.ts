import { errAsync, okAsync } from 'neverthrow';
import { mergedProfile, steamIdsOf, type UserRow } from '../domain/users';
import { conflict, notFound } from '../errors';
import { fromPb, pbMaybe, sequence, type Task } from '../result';
import { Service } from './service';

type MergeResult =
	| { merged: false; keeperId?: undefined; loserIds?: undefined }
	| { merged: boolean; keeperId: string; loserIds: string[] };

type ConflictAccount = {
	id: string;
	name: string;
	role: string;
	steamIds: string[];
	lastLogin: string;
};

export type SteamConflict = {
	id: string;
	steamId: string;
	created: string;
	requester: ConflictAccount | null;
	owners: ConflictAccount[];
};

type ConflictRow = { id: string; user: string; steamId: string; owners: unknown; created: string };

const USERS = '_pb_users_auth_';
const ACCOUNT_FIELDS = 'id,name,role,steamIds,meta,lastLogin,created';

const ownerIds = (row: Pick<ConflictRow, 'owners'>) =>
	(Array.isArray(row.owners) ? row.owners : []).map(String);

/**
 * Accounts: linking Steam ids, the staff merge of duplicate accounts and the
 * anti-cheat labels that follow a user's Steam ids.
 */
export class UsersService extends Service {
	/**
	 * Uploads of the same replay (title, file name and game date) keep the newest. Replays
	 * without a game date or title cannot be told apart, so they are never removed.
	 */
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
					const title = row.title?.trim() ?? '';
					if (!row.gameDate || !title || title === '-') {
						return false;
					}

					const key = `${title}||${row.filename}||${row.gameDate}`;
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

	/** The Steam ids linked to the account. */
	steamIdsOf(userId: string): Task<string[]> {
		return fromPb(
			this.pb.collection('users').getOne<UserRow>(userId, { fields: 'steamIds' }),
			'User not found'
		).map(steamIdsOf);
	}

	private usersByIds(ids: string[], fields = ACCOUNT_FIELDS): Task<UserRow[]> {
		if (ids.length === 0) {
			return okAsync([]);
		}

		return fromPb(
			this.pb.collection('users').getFullList<UserRow>({
				filter: ids.map((id) => this.pb.filter('id = {:id}', { id })).join(' || '),
				fields
			}),
			'Could not load users'
		);
	}

	/**
	 * Links a Steam id the desktop app saw in the game log (trust on first use): only an
	 * id no other account has is added. Otherwise staff get a conflict to resolve.
	 */
	linkSteamId(userId: string, steamId: string): Task<{ steamIds: string[] }> {
		return fromPb(
			this.pb.collection('users').getFullList<UserRow>({
				filter: this.pb.filter('steamIds ~ {:steamId}', { steamId: `"${steamId}"` }),
				fields: 'id,steamIds'
			}),
			'Could not load users'
		).andThen((owners) => {
			const others = owners
				.filter((owner) => owner.id !== userId && steamIdsOf(owner).includes(steamId))
				.map((owner) => owner.id);
			if (others.length > 0) {
				return this.recordConflict(userId, steamId, others).andThen(() =>
					errAsync(
						conflict('This Steam account belongs to another account. Staff have been notified.')
					)
				);
			}

			return this.addSteamId(userId, steamId);
		});
	}

	private addSteamId(userId: string, steamId: string): Task<{ steamIds: string[] }> {
		return fromPb(
			this.pb.collection('users').getOne<UserRow>(userId, { fields: 'steamIds' }),
			'User not found'
		).andThen((user) => {
			const steamIds = steamIdsOf(user);
			if (steamIds.includes(steamId)) {
				return okAsync({ steamIds });
			}

			const next = [...steamIds, steamId];
			return fromPb(
				this.pb.collection('users').update(userId, { steamIds: next }),
				'Could not link the Steam account'
			)
				.andThen(() => this.syncCheaterLabels(userId))
				.map(() => ({ steamIds: next }));
		});
	}

	private recordConflict(userId: string, steamId: string, owners: string[]): Task<void> {
		const conflicts = this.pb.collection('steam_link_conflicts');
		return pbMaybe(
			conflicts.getFirstListItem<{ id: string }>(
				this.pb.filter('user = {:userId} && steamId = {:steamId}', { userId, steamId })
			),
			'Could not load Steam conflicts'
		)
			.andThen((existing) =>
				fromPb(
					existing
						? conflicts.update(existing.id, { owners, resolved: false })
						: conflicts.create({ user: userId, steamId, owners }),
					'Could not save Steam conflict'
				)
			)
			.map(() => undefined);
	}

	/**
	 * Steam ids several accounts already share (linked before trust on first use). They show
	 * up as conflicts without a requester; staff merge them, they cannot be dismissed.
	 */
	private sharedSteamIds(): Task<ConflictRow[]> {
		return fromPb(
			this.pb.collection('user_steam_duplicates').getFullList<{ id: string }>({ fields: 'id' }),
			'Could not load duplicate accounts'
		).andThen((duplicates) =>
			sequence(duplicates, (duplicate) =>
				fromPb(
					this.pb.collection('users').getFullList<UserRow>({
						filter: this.pb.filter('steamIds ~ {:steamId}', { steamId: `"${duplicate.id}"` }),
						fields: 'id,steamIds,created'
					}),
					'Could not load users'
				).map(
					(owners): ConflictRow => ({
						id: `shared:${duplicate.id}`,
						user: '',
						steamId: duplicate.id,
						owners: owners
							.filter((owner) => steamIdsOf(owner).includes(duplicate.id))
							.map((owner) => owner.id),
						created: ''
					})
				)
			)
		);
	}

	/** Open Steam conflicts for the staff admin tab, with the accounts involved. */
	listConflicts(): Task<SteamConflict[]> {
		return fromPb(
			this.pb
				.collection('steam_link_conflicts')
				.getFullList<ConflictRow>({ filter: 'resolved = false', sort: '-created' }),
			'Could not load Steam conflicts'
		)
			.andThen((rows) => this.sharedSteamIds().map((shared) => [...rows, ...shared]))
			.andThen((rows) =>
				this.usersByIds(
					[...new Set(rows.flatMap((row) => [row.user, ...ownerIds(row)]))].filter(Boolean)
				).map((users) => {
					const byId = new Map(users.map((user) => [user.id, user]));
					const account = (id: string): ConflictAccount | null => {
						const user = byId.get(id);
						if (!user) {
							return null;
						}

						return {
							id,
							name: user.name ?? '',
							role: user.role ?? '',
							steamIds: steamIdsOf(user),
							lastLogin: user.lastLogin ?? ''
						};
					};
					return rows.map((row) => ({
						id: row.id,
						steamId: row.steamId,
						created: row.created,
						requester: account(row.user),
						owners: ownerIds(row)
							.map(account)
							.filter((owner): owner is ConflictAccount => owner !== null)
					}));
				})
			);
	}

	dismissConflict(id: string): Task<void> {
		return fromPb(
			this.pb.collection('steam_link_conflicts').update(id, { resolved: true }),
			'Steam conflict not found'
		).map(() => undefined);
	}

	/**
	 * Staff merge: every account in `userIds` moves into `keeperId`, which keeps its own role.
	 * A loser is only deleted once all of its rows moved; run it again after a partial failure.
	 */
	mergeAccounts(keeperId: string, userIds: string[]): Task<MergeResult> {
		const ids = [...new Set([keeperId, ...userIds])];
		return this.usersByIds(ids).andThen((users) => {
			const keeper = users.find((user) => user.id === keeperId);
			if (!keeper || users.length !== ids.length) {
				return errAsync(notFound('Account not found'));
			}

			return this.merge(keeper, users).andThen((result) =>
				this.resolveConflictsOf(ids).map(() => result)
			);
		});
	}

	private resolveConflictsOf(userIds: string[]): Task<void> {
		return fromPb(
			this.pb.collection('steam_link_conflicts').getFullList<{ id: string }>({
				filter: userIds.map((id) => this.pb.filter('user = {:id}', { id })).join(' || '),
				fields: 'id'
			}),
			'Could not load Steam conflicts'
		)
			.andThen((rows) => sequence(rows, (row) => this.dismissConflict(row.id)))
			.map(() => undefined);
	}

	private merge(keeper: UserRow, users: UserRow[]): Task<MergeResult> {
		const losers = users.filter((user) => user.id !== keeper.id);
		if (losers.length === 0) {
			return okAsync({ merged: false });
		}

		return sequence(losers, (loser) =>
			this.services.relations
				.move(USERS, loser.id, keeper.id)
				.map((failed) => (failed === 0 ? loser.id : ''))
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
}
