/** Test double for $app/navigation */

export const __navigation = {
	visits: [] as string[],
	reset() {
		this.visits = [];
	}
};

export async function goto(url: string): Promise<void> {
	__navigation.visits.push(url);
}
