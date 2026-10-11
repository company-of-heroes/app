import { invoke } from '@tauri-apps/api/core';
import { fetch } from '$core/http/fetch';

/**
 * Unzips a file to a specified destination directory.
 * Supports zip bytes, local file paths and remote URLs.
 *
 * @param zip - The zip bytes, the path to a zip file, or a remote URL
 * @param destination - The absolute path to the destination directory
 * @returns A promise that resolves when the extraction is complete
 * @throws An error if the extraction fails
 *
 * @example
 * ```ts
 * // From bytes (e.g. a fetched Vite ?url asset)
 * await unzip(bytes, '/path/to/destination');
 *
 * // From a local file path
 * await unzip('/path/to/file.zip', '/path/to/destination');
 *
 * // From a remote URL
 * await unzip('https://example.com/file.zip', '/path/to/destination');
 * ```
 */
export async function unzip(zip: Uint8Array | string, destination: string): Promise<void> {
	if (zip instanceof Uint8Array) {
		await unzipBytes(zip, destination);
		return;
	}

	if (/^https?:\/\//i.test(zip)) {
		const response = await fetch(zip);
		if (!response.ok) {
			throw new Error(`Failed to fetch zip file: ${response.status} ${response.statusText}`);
		}

		await unzipBytes(new Uint8Array(await response.arrayBuffer()), destination);
		return;
	}

	await invoke('unzip_file', { zipPath: zip, destination });
}

/** Sends the zip as the raw IPC body; the destination goes URI-encoded in a header. */
function unzipBytes(bytes: Uint8Array, destination: string): Promise<void> {
	return invoke('unzip_bytes', bytes, {
		headers: { 'x-unzip-destination': encodeURIComponent(destination) }
	});
}
