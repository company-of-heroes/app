import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

// https://v2.tauri.app/start/frontend/sveltekit/
export default defineConfig(({ mode }) => {
	const host = process.env.TAURI_DEV_HOST;
	// scripts/tauri.mjs picks a free port and passes the same one to Tauri's devUrl.
	const port = Number(process.env.REPLAY_PARSER_PORT) || 1430;

	return {
		define: {
			'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
			global: 'globalThis'
		},
		plugins: [sveltekit(), tailwindcss()],
		// Keep Rust errors visible; strictPort so Vite never drifts from Tauri's devUrl.
		clearScreen: false,
		server: {
			fs: {
				allow: ['..']
			},
			port,
			strictPort: true,
			host: host || false,
			hmr: host
				? {
						protocol: 'ws',
						host,
						port: port + 1
					}
				: undefined,
			watch: {
				ignored: ['**/src-tauri/**']
			}
		}
	};
});
