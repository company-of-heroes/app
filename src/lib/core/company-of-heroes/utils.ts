import { invoke } from '@tauri-apps/api/core';

export async function isRunning(processName: string): Promise<boolean> {
	return await invoke<boolean>('is_running', { processName });
}
