import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { base64 } from 'vite-plugin-base64';
import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRODUCTION_PB_URL = 'https://api.coh1stats.com';
const PRODUCTION_SITE_URL = 'https://coh1stats.com';

// Custom plugin to handle ?base64 imports
function base64Plugin() {
	return {
		name: 'vite-plugin-base64-suffix',
		enforce: /** @type {'pre'} */ ('pre'),
		load(/** @type {string} */ id) {
			if (id.includes('?base64')) {
				const filePath = id.split('?')[0];
				try {
					const fileBuffer = readFileSync(filePath);
					const base64String = fileBuffer.toString('base64');
					return `export default "${base64String}";`;
				} catch (error) {
					console.error(`Failed to read file for base64 conversion: ${filePath}`, error);
					return null;
				}
			}
		}
	};
}

function whatsNewPlugin() {
	const dir = path.resolve(__dirname, 'static/whats-new');
	const virtualId = 'virtual:whats-new';
	const resolvedId = `\0${virtualId}`;

	function list() {
		if (!existsSync(dir)) {
			return [];
		}

		return readdirSync(dir)
			.filter((name) => /^v.+\.md$/i.test(name))
			.map((name) => ({
				name,
				url: `/whats-new/${name}`
			}));
	}

	return {
		name: 'whats-new',
		resolveId(id) {
			if (id === virtualId) {
				return resolvedId;
			}
		},
		load(id) {
			if (id === resolvedId) {
				return `export const whatsNewFiles = ${JSON.stringify(list())};`;
			}
		},
		configureServer(server) {
			server.watcher.add(dir);
			server.watcher.on('all', (_event, file) => {
				const resolved = path.resolve(file);
				if (!resolved.startsWith(dir) || !resolved.endsWith('.md')) {
					return;
				}

				const mod = server.moduleGraph.getModuleById(resolvedId);
				if (mod) {
					void server.reloadModule(mod);
				}
			});
		}
	};
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	// Production builds must never ship with a localhost PocketBase / site URL,
	// even if packages/app/.env (or the shell) still points at local hosts.
	if (mode === 'production') {
		process.env.PUBLIC_PB_URL = PRODUCTION_PB_URL;
		process.env.PUBLIC_SITE_URL = PRODUCTION_SITE_URL;
	}

	const host = process.env.TAURI_DEV_HOST;

	return {
		define: {
			'process.env': process.env,
			global: 'globalThis'
		},
		assetsInclude: ['*.md'],
		resolve: {
			alias: {
				'@tauri-apps/plugin-http-original': path.resolve(
					__dirname,
					'node_modules/@tauri-apps/plugin-http/dist-js/index.js'
				)
			}
		},
		plugins: [base64Plugin(), whatsNewPlugin(), sveltekit(), tailwindcss(), base64()],
		// Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
		//
		// 1. prevent vite from obscuring rust errors
		clearScreen: false,
		// 2. tauri expects a fixed port, fail if that port is not available
		server: {
			fs: {
				allow: ['..']
			},
			port: 1420,
			strictPort: true,
			host: host || false,
			hmr: host
				? {
						protocol: 'ws',
						host,
						port: 1421
					}
				: undefined,
			watch: {
				// 3. tell vite to ignore watching `src-tauri`
				ignored: ['**/src-tauri/**']
			}
		}
	};
});
