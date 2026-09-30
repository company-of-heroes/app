/** JSON with object keys sorted, so stored (key-sorted by PocketBase) and fresh values compare equal. */
function canonical(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(canonical);
	}

	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, canonical((value as Record<string, unknown>)[key])])
		);
	}

	return value;
}

export function sameJson(a: unknown, b: unknown): boolean {
	return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
