/** Test double for @tauri-apps/api/path */

export const __paths = {
	documentDir: 'C:/Users/test/Documents',
	appConfigDir: 'C:/Users/test/AppData/Roaming/com.fknoobscoh.app'
};

function normalize(path: string): string {
	return path.replace(/\\/g, '/').replace(/\/+$/, '');
}

export async function join(...segments: string[]): Promise<string> {
	return segments
		.filter(Boolean)
		.map((s, i) => (i === 0 ? normalize(s) : normalize(s).replace(/^\/+/, '')))
		.join('/');
}

export async function dirname(path: string): Promise<string> {
	const normalized = normalize(path);
	const idx = normalized.lastIndexOf('/');
	if (idx <= 0) throw new Error(`Cannot get dirname of: ${path}`);
	return normalized.slice(0, idx);
}

export async function basename(path: string): Promise<string> {
	const normalized = normalize(path);
	return normalized.slice(normalized.lastIndexOf('/') + 1);
}

export async function documentDir(): Promise<string> {
	return __paths.documentDir;
}

export async function appConfigDir(): Promise<string> {
	return __paths.appConfigDir;
}

export async function appDataDir(): Promise<string> {
	return __paths.appConfigDir;
}
