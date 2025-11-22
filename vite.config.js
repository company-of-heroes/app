import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { base64 } from 'vite-plugin-base64';
import { readFileSync } from 'fs';

const host = process.env.TAURI_DEV_HOST;

// Custom plugin to handle ?base64 imports
function base64Plugin() {
	return {
		name: 'vite-plugin-base64-suffix',
		enforce: /** @type {'pre'} */ ('pre'),
		load(id) {
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

// https://vitejs.dev/config/
export default defineConfig({
	define: {
		'process.env': process.env
	},
	plugins: [base64Plugin(), sveltekit(), tailwindcss(), base64()],
	// Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
	//
	// 1. prevent vite from obscuring rust errors
	clearScreen: false,
	// 2. tauri expects a fixed port, fail if that port is not available
	server: {
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
});
