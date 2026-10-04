#!/usr/bin/env node
/**
 * Components live once, in packages/ui. Fails when the same component file name exists in more
 * than one host (packages/app, packages/website, packages/replay-parser); warns when a host file
 * shares its name with a ui component (usually a leftover wrapper — move the logic into ui + the
 * host context instead).
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
const replayParser = components('packages/replay-parser/src/lib/components');
const ui = components('packages/ui/src');
const hosts = [app, website, replayParser];

const pathsOf = (name) => hosts.flatMap((host) => host.get(name) ?? []);
const names = new Set(hosts.flatMap((host) => [...host.keys()]));
const duplicates = [...names].filter((name) => hosts.filter((host) => host.has(name)).length > 1);
const shadowed = [...names].filter((name) => ui.has(name));

for (const name of shadowed) {
	console.warn(`warn: ${pathsOf(name).join(', ')} has the same name as ${ui.get(name).join(', ')}`);
}

if (duplicates.length > 0) {
	console.error('\nComponents that exist in more than one host (move them into packages/ui):');
	for (const name of duplicates) {
		console.error(`  ${name}: ${pathsOf(name).join(', ')}`);
	}

	process.exit(1);
}

console.log(
	`ok: no component exists in more than one host (${app.size} app, ${website.size} website, ${replayParser.size} replay parser).`
);
