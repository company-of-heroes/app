/**
 * Generates a random password using alphanumeric characters (no special characters).
 *
 * @param length Length of the password (default: 16)
 * @returns The generated password string
 */
export function generatePassword(length = 16): string {
	const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let password = '';
	for (let i = 0; i < length; i++) {
		const randomIndex = Math.floor(Math.random() * charset.length);
		password += charset[randomIndex];
	}
	return password;
}

/**
 * Generates a unique ID matching the pattern [a-z0-9]{15}.
 *
 * @param length Length of the ID (default: 15)
 * @returns The generated unique ID string
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
