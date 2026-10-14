#!/usr/bin/env node
// Builds the Tauri updater manifest (latest.json) and SHA256SUMS for a desktop
// release from its downloaded assets.
//
// Used by the desktop release workflows after the Windows and Linux builds have
// uploaded to the same release. Building the manifest once, at the end, avoids
// two matrix jobs racing to merge latest.json.
//
//   node scripts/release-manifest.mjs --dir assets --out out --tag v0.73.0 --version 0.73.0
//
// Optional `GITHUB_REPOSITORY` (owner/repo) builds the download URLs; defaults to
// company-of-heroes/app.

import { createHash } from 'node:crypto';
import { createReadStream, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_REPO = 'company-of-heroes/app';

/** installer key -> [os, matches file name]. The first per OS is the default target. */
const INSTALLERS = [
	['nsis', 'windows', (name) => name.endsWith('-setup.exe')],
	['msi', 'windows', (name) => name.endsWith('.msi')],
	['appimage', 'linux', (name) => name.endsWith('.AppImage')],
	['deb', 'linux', (name) => name.endsWith('.deb')],
	['rpm', 'linux', (name) => name.endsWith('.rpm')]
];

function argValue(name) {
	const index = process.argv.indexOf(`--${name}`);
	const value = index === -1 ? undefined : process.argv[index + 1];
	if (!value) {
		console.error(`Missing --${name}`);
		process.exit(1);
	}

	return value;
}

function archOf(name) {
	return /(aarch64|arm64)/i.test(name) ? 'aarch64' : 'x86_64';
}

function sha256(path) {
	return new Promise((resolve, reject) => {
		const hash = createHash('sha256');
		createReadStream(path)
			.on('data', (chunk) => hash.update(chunk))
			.on('end', () => resolve(hash.digest('hex')))
			.on('error', reject);
	});
}

const dir = argValue('dir');
const out = argValue('out');
const tag = argValue('tag');
const version = argValue('version');
const repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO;
const files = readdirSync(dir).sort();
const platforms = {};

for (const [installer, os, matches] of INSTALLERS) {
	for (const name of files.filter(matches)) {
		if (!files.includes(`${name}.sig`)) {
			console.warn(`No updater signature for ${name}; skipping it in latest.json`);
			continue;
		}

		const entry = {
			signature: readFileSync(join(dir, `${name}.sig`), 'utf8').trim(),
			url: `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(name)}`
		};
		const target = `${os}-${archOf(name)}`;
		platforms[`${target}-${installer}`] = entry;
		platforms[target] ??= entry;
	}
}

if (Object.keys(platforms).length === 0) {
	console.error('No signed installers found; refusing to write an empty latest.json');
	process.exit(1);
}

const sums = [];
for (const name of files) {
	if (name.endsWith('.sig') || name === 'latest.json' || name === 'SHA256SUMS') {
		continue;
	}

	sums.push(`${await sha256(join(dir, name))}  ${name}`);
}

mkdirSync(out, { recursive: true });
writeFileSync(
	join(out, 'latest.json'),
	`${JSON.stringify(
		{
			version,
			notes: 'See the changelog in the app or on GitHub.',
			pub_date: new Date().toISOString(),
			platforms
		},
		null,
		2
	)}\n`
);
writeFileSync(join(out, 'SHA256SUMS'), `${sums.join('\n')}\n`);

console.log(`latest.json targets: ${Object.keys(platforms).join(', ')}`);
console.log(`SHA256SUMS: ${sums.length} files`);
