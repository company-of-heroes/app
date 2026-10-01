/**
 * Accounts: one person may end up with several `users` rows sharing a Steam id
 * (signed up twice, app and website). Staff merge those into a keeper they pick.
 */

export type UserRow = {
	id: string;
	name?: string;
	role?: string;
	steamIds?: unknown;
	meta?: unknown;
	lastLogin?: string;
	created?: string;
};

export function steamIdsOf(user: Pick<UserRow, 'steamIds'>): string[] {
	const list = Array.isArray(user.steamIds) ? user.steamIds : [];
	return [...new Set(list.map((id) => String(id).trim()).filter(Boolean))];
}

function appVersion(user: UserRow): number[] {
	const meta =
		user.meta && typeof user.meta === 'object' ? (user.meta as { version?: unknown }) : {};
	return String(meta.version ?? '0')
		.split(/[-+]/)[0]
		.split('.')
		.map((part) => parseInt(part, 10) || 0);
}

function compareVersions(a: number[], b: number[]): number {
	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		const diff = (a[i] ?? 0) - (b[i] ?? 0);
		if (diff) {
			return diff;
		}
	}
	return 0;
}

const time = (value?: string) => {
	const ms = value ? Date.parse(value) : NaN;
	return Number.isNaN(ms) ? 0 : ms;
};

/** Newest app version first, then most recent login, then newest account. */
export function byRecency(a: UserRow, b: UserRow): number {
	return (
		compareVersions(appVersion(b), appVersion(a)) ||
		time(b.lastLogin) - time(a.lastLogin) ||
		time(b.created) - time(a.created)
	);
}

/**
 * The keeper's profile after a merge: every Steam id, a name, the latest login.
 * The role stays the keeper's own: a merge never grants another account's rights.
 */
export function mergedProfile(keeper: UserRow, users: UserRow[]) {
	const name =
		keeper.name?.trim() ||
		[...users]
			.sort(byRecency)
			.find((user) => user.name?.trim())
			?.name?.trim() ||
		'';
	const lastLogin = users.reduce(
		(latest, user) => (time(user.lastLogin) > time(latest) ? (user.lastLogin ?? '') : latest),
		keeper.lastLogin ?? ''
	);
	return {
		steamIds: [...new Set(users.flatMap(steamIdsOf))],
		...(name ? { name } : {}),
		...(lastLogin ? { lastLogin } : {})
	};
}

/**
 * The other columns of UNIQUE indexes that include `field`, e.g. `lobby` for
 * `UNIQUE (lobby, user)`: a moved row conflicts when the keeper already has one
 * with the same values there (an empty list: the keeper may have only one row).
 */
export function uniquePeers(indexes: string[], field: string): string[][] {
	return indexes.flatMap((sql) => {
		if (!/\bUNIQUE\b/i.test(sql)) {
			return [];
		}

		const columns = (sql.match(/\(([^)]*)\)\s*(WHERE.*)?$/is)?.[1] ?? '')
			.split(',')
			.map((column) => column.trim().replace(/[`"[\]]/g, ''));
		return columns.includes(field) ? [columns.filter((column) => column !== field)] : [];
	});
}
