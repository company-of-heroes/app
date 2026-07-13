import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
	base: './',
	server: {
		port: 5173,
		open: true
	},
	build: {
		outDir: 'dist',
		emptyOutDir: true
	},
	plugins: [svelte()]
});
