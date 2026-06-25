/** Test double for @tauri-apps/plugin-dialog */

export const __dialog = {
	openResult: null as string | string[] | null,
	saveResult: null as string | null,
	confirmResult: false,
	reset() {
		this.openResult = null;
		this.saveResult = null;
		this.confirmResult = false;
	}
};

export async function open(_options?: unknown): Promise<string | string[] | null> {
	return __dialog.openResult;
}

export async function save(_options?: unknown): Promise<string | null> {
	return __dialog.saveResult;
}

export async function confirm(_message: string, _options?: unknown): Promise<boolean> {
	return __dialog.confirmResult;
}

export async function message(_message: string, _options?: unknown): Promise<void> {}
