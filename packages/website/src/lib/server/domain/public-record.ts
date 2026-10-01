/** What anyone may see of an account inside an expanded record. */
const PUBLIC_USER_FIELDS = ['id', 'collectionId', 'collectionName', 'name', 'avatar', 'steamIds'];

const isUser = (record: Record<string, unknown>) =>
	record.collectionName === 'users' || record.collectionId === '_pb_users_auth_';

function publicValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(publicValue);
	}

	return value && typeof value === 'object'
		? publicRecord(value as Record<string, unknown>)
		: value;
}

/**
 * A record as returned to clients by superuser reads: expanded users keep only their
 * public fields (superusers see `email` and the rest regardless of the rules).
 */
export function publicRecord<T>(record: T): T {
	if (!record || typeof record !== 'object' || Array.isArray(record)) {
		return record;
	}

	const source = record as Record<string, unknown>;
	const entries = isUser(source)
		? PUBLIC_USER_FIELDS.filter((key) => key in source).map((key) => [key, source[key]])
		: Object.entries(source);
	const result = Object.fromEntries(entries);
	if (source.expand && typeof source.expand === 'object') {
		result.expand = Object.fromEntries(
			Object.entries(source.expand as Record<string, unknown>).map(([key, value]) => [
				key,
				publicValue(value)
			])
		);
	}

	return result as T;
}
