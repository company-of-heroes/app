#!/usr/bin/env node
// Custom version step for the Tauri app.
//
// Consumes pending changesets in `.changeset/*.md`, bumps the app version in
// package.json, tauri.conf.json and Cargo.toml (all kept in sync), and prepends
// the changeset summaries to the root CHANGELOG.md in the project's own format:
//
//   ### vX.Y.Z
//
//   - <summary>
//
// Run via `pnpm version-packages`.

import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const APP_PACKAGE = '@company-of-heroes/app';
const BUMP_RANK = { patch: 1, minor: 2, major: 3 };
const DRY_RUN = process.argv.includes('--dry-run');

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDir, '..');

const paths = {
	changesetDir: join(root, '.changeset'),
	changelog: join(root, 'CHANGELOG.md'),
	packageJson: join(root, 'packages/app/package.json'),
	tauriConf: join(root, 'packages/app/src-tauri/tauri.conf.json'),
	cargoToml: join(root, 'packages/app/src-tauri/Cargo.toml')
};

/** Reads and parses every pending changeset that targets the app package. */
function readChangesets() {
	const files = readdirSync(paths.changesetDir).filter(
		(name) => name.endsWith('.md') && name.toLowerCase() !== 'readme.md'
	);

	const changesets = [];

	for (const file of files) {
		const fullPath = join(paths.changesetDir, file);
		const raw = readFileSync(fullPath, 'utf8');
		const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

		if (!match) {
			continue;
		}

		const [, frontmatter, body] = match;
		const bumps = {};

		for (const line of frontmatter.split(/\r?\n/)) {
			const entry = line.match(/^\s*['"]?(.+?)['"]?\s*:\s*(major|minor|patch)\s*$/);
			if (entry) {
				bumps[entry[1]] = entry[2];
			}
		}

		const appBump = bumps[APP_PACKAGE];
		if (!appBump) {
			// Not an app-facing changeset; leave it untouched for other tooling.
			continue;
		}

		changesets.push({ file, fullPath, bump: appBump, summary: body.trim() });
	}

	return changesets;
}

/** Bumps a semver `X.Y.Z` string by the given release type. */
function bumpVersion(current, bump) {
	const match = current.match(/^(\d+)\.(\d+)\.(\d+)/);
	if (!match) {
		throw new Error(`Cannot parse current version: "${current}"`);
	}

	let [major, minor, patch] = match.slice(1).map(Number);

	if (bump === 'major') {
		major += 1;
		minor = 0;
		patch = 0;
	} else if (bump === 'minor') {
		minor += 1;
		patch = 0;
	} else {
		patch += 1;
	}

	return `${major}.${minor}.${patch}`;
}

/** tauri.conf.json is the source of truth for the current version. */
function readCurrentVersion() {
	const conf = JSON.parse(readFileSync(paths.tauriConf, 'utf8'));
	if (!conf.version) {
		throw new Error('No "version" found in tauri.conf.json');
	}
	return conf.version;
}

function replaceFirst(filePath, regex, replacement) {
	const content = readFileSync(filePath, 'utf8');
	if (!regex.test(content)) {
		throw new Error(`Could not find version field in ${filePath}`);
	}
	writeFileSync(filePath, content.replace(regex, replacement));
}

/** Replaces the `version = "..."` line inside Cargo.toml's [package] section only. */
function writeCargoVersion(newVersion) {
	const content = readFileSync(paths.cargoToml, 'utf8');
	const lines = content.split(/\r?\n/);

	let inPackage = false;
	let replaced = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const section = line.match(/^\s*\[([^\]]+)\]/);

		if (section) {
			inPackage = section[1] === 'package';
			continue;
		}

		if (inPackage && /^\s*version\s*=/.test(line)) {
			lines[i] = `version = "${newVersion}"`;
			replaced = true;
			break;
		}
	}

	if (!replaced) {
		throw new Error('Could not find [package] version in Cargo.toml');
	}

	writeFileSync(paths.cargoToml, lines.join('\n'));
}

/** Turns changeset bodies into CHANGELOG bullet lines. */
function toBullets(changesets) {
	const bullets = [];

	for (const changeset of changesets) {
		const lines = changeset.summary.split(/\r?\n/).map((line) => line.trim());

		for (const line of lines) {
			if (!line) continue;
			bullets.push(line.startsWith('-') ? line : `- ${line}`);
		}
	}

	return bullets;
}

function prependChangelog(newVersion, bullets) {
	const existing = readFileSync(paths.changelog, 'utf8');
	const entry = `### v${newVersion}\n\n${bullets.join('\n')}\n\n`;
	writeFileSync(paths.changelog, entry + existing);
}

function main() {
	const changesets = readChangesets();

	if (changesets.length === 0) {
		console.log('No app changesets found. Nothing to version.');
		return;
	}

	const bump = changesets
		.map((changeset) => changeset.bump)
		.reduce((highest, current) => (BUMP_RANK[current] > BUMP_RANK[highest] ? current : highest));

	const currentVersion = readCurrentVersion();
	const newVersion = bumpVersion(currentVersion, bump);
	const bullets = toBullets(changesets);

	if (DRY_RUN) {
		console.log(`[dry-run] ${currentVersion} -> ${newVersion} (${bump})`);
		console.log('[dry-run] Would sync version in package.json, tauri.conf.json, Cargo.toml.');
		console.log(`[dry-run] Would prepend to CHANGELOG.md:\n`);
		console.log(`### v${newVersion}\n\n${bullets.join('\n')}\n`);
		console.log(`[dry-run] Would consume: ${changesets.map((c) => c.file).join(', ')}`);
		return;
	}

	replaceFirst(paths.packageJson, /("version":\s*")[^"]+(")/, `$1${newVersion}$2`);
	replaceFirst(paths.tauriConf, /("version":\s*")[^"]+(")/, `$1${newVersion}$2`);
	writeCargoVersion(newVersion);
	prependChangelog(newVersion, bullets);

	for (const changeset of changesets) {
		rmSync(changeset.fullPath);
	}

	console.log(`Bumped ${currentVersion} -> ${newVersion} (${bump})`);
	console.log(`Updated package.json, tauri.conf.json, Cargo.toml and CHANGELOG.md`);
	console.log(`Consumed ${changesets.length} changeset(s).`);
}

main();
