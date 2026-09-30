#!/usr/bin/env node
/**
 * Components live once, in packages/ui. Fails when the same component file name exists in both
 * hosts (packages/app and packages/website); warns when a host file shares its name with a ui
 * component (usually a leftover wrapper — move the logic into ui + the host context instead).
 */
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function components(dir) {
	const out = new Map();
	const walk = (current) => {
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			const path = join(current, entry.name);
			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.name.endsWith('.svelte')) {
				out.set(entry.name, [...(out.get(entry.name) ?? []), relative(root, path)]);
			}
		}
	};
	walk(join(root, dir));
	return out;
}

const app = components('packages/app/src/lib/components');
const website = components('packages/website/src/lib/components');
const ui = components('packages/ui/src');

const duplicates = [...app.keys()].filter((name) => website.has(name));
const shadowed = [...app.keys(), ...website.keys()].filter((name) => ui.has(name));

for (const name of shadowed) {
	const hosts = [...(app.get(name) ?? []), ...(website.get(name) ?? [])].join(', ');
	console.warn(`warn: ${hosts} has the same name as ${ui.get(name).join(', ')}`);
}

if (duplicates.length > 0) {
	console.error('\nComponents that exist in both hosts (move them into packages/ui):');
	for (const name of duplicates) {
		console.error(`  ${name}: ${[...app.get(name), ...website.get(name)].join(', ')}`);
	}

	process.exit(1);
}

console.log(`ok: no component exists in both hosts (${app.size} app, ${website.size} website).`);
