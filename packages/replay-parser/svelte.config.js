// Tauri has no Node server: adapter-static prerenders the app (SSG).
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		paths: {
			relative: false
		},
		adapter: adapter({
			fallback: 'index.html'
		}),
		alias: {
			'@assets': '../shared-assets'
		}
	},
	compilerOptions: {
		experimental: {
			async: true
		}
	}
};

export default config;
