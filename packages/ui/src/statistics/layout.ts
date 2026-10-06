/** Grid tracks shared by the statistics components and their skeletons. */
export function mapColumns(compact: boolean): string {
	return compact
		? 'grid-cols-[minmax(0,1fr)_3.5rem_minmax(8rem,10rem)]'
		: 'grid-cols-[1.5rem_minmax(0,1fr)_5.5rem_4rem_minmax(10rem,13rem)]';
}

export const keyNumbersGrid =
	'divide-secondary-800 grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0';
