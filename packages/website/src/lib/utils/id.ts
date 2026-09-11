/**
 * Generates a unique ID matching the PocketBase users pattern [a-z0-9]{15}.
 */
export function generateUniqueId(length = 15): string {
	const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let id = '';
	for (let i = 0; i < length; i++) {
		const randomIndex = Math.floor(Math.random() * charset.length);
		id += charset[randomIndex];
	}
	return id;
}
