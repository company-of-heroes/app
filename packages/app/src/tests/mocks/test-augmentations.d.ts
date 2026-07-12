/**
 * Type augmentations for the Tauri test doubles.
 *
 * At runtime, vitest aliases the Tauri packages to the mocks in this folder.
 * These augmentations expose the mock-only helpers (`__fs`, `__dialog`, ...)
 * on the real module types so test files type-check against the package
 * specifiers they import from.
 */

import '@tauri-apps/plugin-fs';
import '@tauri-apps/plugin-dialog';
import '@tauri-apps/plugin-http-original';
import '@tauri-apps/api/path';
import '@tauri-apps/api/app';
import '@tauri-apps/api/core';

declare module '@tauri-apps/plugin-fs' {
	export const __fs: {
		reset(): void;
		setFile(path: string, content: string | Uint8Array): void;
		setDir(path: string): void;
		getFileText(path: string): string | undefined;
		has(path: string): boolean;
		listFiles(): string[];
		append(path: string, content: string): void;
	};
}

declare module '@tauri-apps/plugin-dialog' {
	export const __dialog: {
		openResult: string | string[] | null;
		saveResult: string | null;
		confirmResult: boolean;
		reset(): void;
	};
}

declare module '@tauri-apps/plugin-http-original' {
	export const __http: {
		setHandler(next: (input: string | URL | Request, init?: RequestInit) => Promise<Response>): void;
		reset(): void;
	};
}

declare module '@tauri-apps/api/path' {
	export const __paths: {
		documentDir: string;
		appConfigDir: string;
	};
}

declare module '@tauri-apps/api/app' {
	export const __app: {
		version: string;
	};
}

declare module '@tauri-apps/api/core' {
	export const __invoke: {
		setHandler(next: (command: string, args?: Record<string, unknown>) => unknown): void;
		reset(): void;
	};
}
