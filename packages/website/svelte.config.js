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
			// Checked in src/lib/hooks/csrf.ts instead, so the Mollie webhook (a form post
			// without an Origin header) gets through. Trusted origins (Tauri) live there too.
			// `*` turns SvelteKit's own check off (the successor of `checkOrigin: false`).
			trustedOrigins: ['*']
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
