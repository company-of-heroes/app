import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';

/**
 * Unzips a file to a specified destination directory.
 * Supports local file paths, remote URLs, Vite ?url imports, and base64-encoded zip data.
 *
 * @param zipPathOrUrl - The path to the zip file, a remote URL, a Vite ?url import, or base64-encoded zip data
 * @param destination - The absolute path to the destination directory
 * @returns A promise that resolves when the extraction is complete
 * @throws An error if the extraction fails
 *
 * @example
 * ```ts
 * // From a local file path
 * await unzip('/path/to/file.zip', '/path/to/destination');
 *
 * // From a remote URL
 * await unzip('https://example.com/file.zip', '/path/to/destination');
 *
 * // From a Vite ?url import
 * import zipUrl from './overlay.zip?url';
 * await unzip(zipUrl, '/path/to/destination');
 *
 * // From a base64-encoded string
 * import zipBase64 from './overlay.zip?base64';
 * await unzip(zipBase64, '/path/to/destination');
 * ```
 */
export async function unzip(zipPathOrUrl: string, destination: string): Promise<void> {
	// Check if it's a URL (http://, https://, or starts with /)
	const isUrl = /^(https?:\/\/|\/)/i.test(zipPathOrUrl);

	// Check if it's base64 data - base64 strings are long and only contain base64 characters
	// Also, file paths typically have extensions like .zip or contain path separators early in the string
	const isBase64 = !isUrl && zipPathOrUrl.length > 200 && /^[A-Za-z0-9+/=]+$/.test(zipPathOrUrl);

	if (isBase64) {
		// Decode base64 to bytes
		const binaryString = atob(zipPathOrUrl);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		await invoke('unzip_bytes', { zipData: Array.from(bytes), destination });
	} else if (isUrl) {
		// Fetch the file as bytes
		const response = await fetch(zipPathOrUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch zip file: ${response.status} ${response.statusText}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		const bytes = new Uint8Array(arrayBuffer);

		// Use the bytes command
		await invoke('unzip_bytes', { zipData: Array.from(bytes), destination });
	} else {
		// Use the file path command
		await invoke('unzip_file', { zipPath: zipPathOrUrl, destination });
	}
}
