import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, searchForWorkspaceRoot, type Plugin } from 'vite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Watch `packages/shared-assets` in dev. It sits outside the website root, so Vite would not see
 * new files there and `import.meta.glob` results (action icons, timeline art) stayed stale until a
 * restart. Once watched, Vite's own glob handling picks up added and removed files.
 */
/**
 * Every `phosphor-svelte/lib/<Icon>` the website and the shared UI import. Each icon is its own
 * module, and Vite's startup scan misses some of them; one found at runtime makes Vite re-bundle
 * and reload the page, so the first client-side visit to e.g. the wiki fails or reloads. Listing
 * them in `optimizeDeps.include` bundles them all up front.
 */
function phosphorIcons(): string[] {
	const icons = new Set<string>();
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
				continue;
			}

			const path = join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(path);
			} else if (/\.(svelte|ts)$/.test(entry.name)) {
				for (const match of readFileSync(path, 'utf8').matchAll(/phosphor-svelte\/lib\/(\w+)/g)) {
					icons.add(`phosphor-svelte/lib/${match[1]}`);
				}
			}
		}
	};
	walk(fileURLToPath(new URL('./src', import.meta.url)));
	walk(fileURLToPath(new URL('../ui/src', import.meta.url)));
	return [...icons].sort();
}

/**
 * `import wasm from '<pkg>/<file>.wasm?module'` gives a compiled `WebAssembly.Module` (Workers
 * may not compile wasm from bytes at runtime). The build leaves the import to wrangler, whose
 * bundler compiles `.wasm` imports; `vite dev` runs in Node and compiles the file itself.
 */
function wasmModulePlugin(): Plugin {
	const PREFIX = '\0wasm-module:';
	let serve = false;
	return {
		name: 'wasm-module',
		enforce: 'pre',
		configResolved(config) {
			serve = config.command === 'serve';
		},
		async resolveId(source, importer) {
			if (!source.endsWith('.wasm?module')) {
				return null;
			}

			const specifier = source.slice(0, -'?module'.length);
			if (!serve) {
				return { id: specifier, external: true };
			}

			const resolved = await this.resolve(specifier, importer, { skipSelf: true });
			return resolved ? PREFIX + resolved.id : null;
		},
		load(id) {
			if (!id.startsWith(PREFIX)) {
				return null;
			}

			const path = JSON.stringify(id.slice(PREFIX.length));
			return [
				`import { readFileSync } from 'node:fs';`,
				`export default new WebAssembly.Module(readFileSync(${path}));`
			].join('\n');
		}
	};
}

function sharedAssetsWatchPlugin(): Plugin {
	return {
		name: 'shared-assets-watch',
		configureServer(server) {
			server.watcher.add(fileURLToPath(new URL('../shared-assets', import.meta.url)));
		}
	};
}

export default defineConfig({
	plugins: [wasmModulePlugin(), sharedAssetsWatchPlugin(), sveltekit(), tailwindcss()],
	optimizeDeps: {
		include: ['@fknoobs/replay-parser', ...phosphorIcons()]
	},
	worker: {
		format: 'es'
	},
	ssr: {
		// replay-parser ships extensionless relative ESM imports; Vite must bundle it for SSR.
		noExternal: [
			'bits-ui',
			'layerchart',
			'@svelte-i18n/core',
			'@company-of-heroes/i18n',
			'@company-of-heroes/game-data',
			// A dependency of @company-of-heroes/ui; Svelte libraries' plain deps are externalized otherwise.
			'@company-of-heroes/api',
			'@fknoobs/replay-parser'
		]
	},
	server: {
		port: 5174,
		fs: {
			allow: [
				searchForWorkspaceRoot(websiteRoot),
				repoRoot,
				'../app/src/lib/fonts',
				'../app/src/lib/files/maps'
			]
		}
	}
});
