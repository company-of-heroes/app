import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	...svelte.configs.recommended,
	{
		...ts.configs.recommended,
		ignores: ['@typescript-eslint/no-unused-vars']
	},
	{
		settings: [
			'@typescript-eslint/no-unsafe-assignment',
			'@typescript-eslint/no-unsafe-member-access'
		]
	},
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node // Add this if you are using SvelteKit in non-SPA mode
			}
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'], // Add support for additional file extensions, such as .svelte
				parser: ts.parser,
				// We recommend importing and specifying svelte.config.js.
				// By doing so, some rules in eslint-plugin-svelte will automatically read the configuration and adjust their behavior accordingly.
				// While certain Svelte settings may be statically loaded from svelte.config.js even if you don’t specify it,
				// explicitly specifying it ensures better compatibility and functionality.
				svelteConfig
			}
		}
	},
	{
		rules: {
			// Override or add rule settings here, such as:
			// 'svelte/rule-name': 'error'
			'import/order': [
				'error',
				{
					groups: [
						'index',
						'sibling',
						'parent',
						'internal',
						'external',
						'builtin',
						'object',
						'type'
					]
				}
			]
		}
	}
];
