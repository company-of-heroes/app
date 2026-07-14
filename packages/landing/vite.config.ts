import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
	base: '/',
	server: {
		port: 5174,
		open: true
	},
	build: {
		outDir: 'dist',
		emptyOutDir: true
	},
	optimizeDeps: {
		include: ['html-to-image']
	},
	resolve: {
		alias: {
			'@assets': resolve(__dirname, '../shared-assets'),
			'$lib': resolve(__dirname, './src/lib')
		}
	},
	plugins: [tailwindcss(), svelte()]
});
