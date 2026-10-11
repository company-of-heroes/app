/**
 * Maps `items` with at most `limit` calls of `fn` in flight at once.
 * Results keep the order of the input. Rejects on the first failure.
 */
export async function mapLimit<T, R>(
	items: readonly T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;

	async function worker() {
		while (next < items.length) {
			const index = next++;
			results[index] = await fn(items[index], index);
		}
	}

	const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker);
	await Promise.all(workers);
	return results;
}
