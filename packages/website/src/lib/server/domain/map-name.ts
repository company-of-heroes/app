/** "4p_point_du_hoc" -> "Point Du Hoc (4)"; other names: underscores to spaces, words capitalized. */
export function mapDisplayName(map: string): string {
	const sized = /^(\d+)[pP][ _](.+)$/.exec(map);
	const titleCase = (value: string) =>
		value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
	return sized ? `${titleCase(sized[2].toLowerCase())} (${sized[1]})` : titleCase(map);
}
