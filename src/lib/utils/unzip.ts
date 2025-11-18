import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';

/**
 * Unzips a file to a specified destination directory.
 * Supports both local file paths and remote URLs (including Vite ?url imports).
 * 
 * @param zipPathOrUrl - The path to the zip file, a remote URL, or a Vite ?url import
 * @param destination - The absolute path to the destination directory
 * @returns A promise that resolves when the extraction is complete
 * @throws An error if the extraction fails
 * 
 * @example
 * ```ts
 * // From a local file path
 * await unzipFile('/path/to/file.zip', '/path/to/destination');
 * 
 * // From a remote URL
 * await unzipFile('https://example.com/file.zip', '/path/to/destination');
 * 
 * // From a Vite ?url import
 * import zipUrl from './overlay.zip?url';
 * await unzipFile(zipUrl, '/path/to/destination');
 * ```
 */
export async function unzipFile(zipPathOrUrl: string, destination: string): Promise<void> {
	// Check if it's a URL (http://, https://, or starts with /)
	const isUrl = /^(https?:\/\/|\/)/i.test(zipPathOrUrl);
	
	if (isUrl) {
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
