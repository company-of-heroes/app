declare module '@tauri-apps/plugin-http-original' {
	export function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}
