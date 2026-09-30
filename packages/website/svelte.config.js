import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			platformProxy: {
				configPath: 'wrangler.emulate.toml',
				persist: false
			}
		}),
		experimental: {
			remoteFunctions: true
		},
		csrf: {
			// The desktop app's webview uploads replays and overlays (multipart) to the API,
			// directly or through the api gateway. It authenticates with a token header.
			trustedOrigins: ['http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost']
		},
		prerender: {
			entries: ['/privacy', '/es/privacy', '/ko/privacy']
		},
		alias: {
			'@assets': '../shared-assets',
			'@tt-mussels': '../app/src/lib/fonts/TT Mussels',
			'@maps': '../app/src/lib/files/maps'
		}
	},
	compilerOptions: {
		experimental: {
			async: true
		}
	}
};

export default config;
