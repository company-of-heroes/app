/** Test double for @tauri-apps/api/app */

export const __app = {
	version: '0.50.0'
};

export async function getVersion(): Promise<string> {
	return __app.version;
}
