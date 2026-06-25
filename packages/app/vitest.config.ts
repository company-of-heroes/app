import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * Unit test configuration.
 *
 * Tested modules are rune-free TypeScript by design (pure logic + injected ports).
 * Tauri plugins, SvelteKit virtual modules and env modules are aliased to
 * in-memory test doubles under src/tests/mocks.
 */
export default defineConfig({
	test: {
		environment: 'happy-dom',
		include: ['src/**/*.test.ts'],
		clearMocks: true,
		restoreMocks: true
	},
	resolve: {
		alias: [
			// Tauri test doubles
			{ find: '@tauri-apps/plugin-fs', replacement: r('./src/tests/mocks/tauri-fs.ts') },
			{ find: '@tauri-apps/api/path', replacement: r('./src/tests/mocks/tauri-path.ts') },
			{ find: '@tauri-apps/api/app', replacement: r('./src/tests/mocks/tauri-app.ts') },
			{ find: '@tauri-apps/api/core', replacement: r('./src/tests/mocks/tauri-core.ts') },
			{ find: '@tauri-apps/plugin-dialog', replacement: r('./src/tests/mocks/tauri-dialog.ts') },
			{ find: '@tauri-apps/plugin-http', replacement: r('./src/tests/mocks/tauri-http.ts') },
			{ find: '@tauri-apps/plugin-log', replacement: r('./src/tests/mocks/tauri-log.ts') },
			// SvelteKit virtual modules
			{ find: '$app/environment', replacement: r('./src/tests/mocks/app-environment.ts') },
			{ find: '$app/navigation', replacement: r('./src/tests/mocks/app-navigation.ts') },
			{ find: '$env/static/public', replacement: r('./src/tests/mocks/env-static-public.ts') },
			// Project aliases (mirror svelte.config.js)
			{ find: /^\$core\/(.*)$/, replacement: r('./src/lib/core') + '/$1' },
			{ find: /^\$features\/(.*)$/, replacement: r('./src/lib/core/app/features') + '/$1' },
			{ find: /^\$workers\/(.*)$/, replacement: r('./src/lib/workers') + '/$1' },
			{ find: /^\$lib\/(.*)$/, replacement: r('./src/lib') + '/$1' },
			{ find: '$lib', replacement: r('./src/lib') }
		]
	}
});
