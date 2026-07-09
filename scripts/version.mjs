#!/usr/bin/env node
// Custom version step for the Tauri app and PocketBase package.
//
// Consumes pending changesets in `.changeset/*.md`, bumps the app version in
// package.json, tauri.conf.json and Cargo.toml (all kept in sync), and prepends
// the changeset summaries to the root CHANGELOG.md in the project's own format:
//
//   ### vX.Y.Z
//
//   - <summary>
//
// It also maintains packages/app/CHANGELOG.md and packages/pocketbase/CHANGELOG.md
// in the standard changesets format (## X.Y.Z headings). Those per-package files
// are what `changesets/action` reads to build the "Version Packages" PR body.
//
// Run via `pnpm version-packages`.

import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const APP_PACKAGE = '@company-of-heroes/app';
const POCKETBASE_PACKAGE = '@company-of-heroes/pocketbase';
const BUMP_RANK = { patch: 1, minor: 2, major: 3 };
const DRY_RUN = process.argv.includes('--dry-run');

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDir, '..');

const paths = {
	changesetDir: join(root, '.changeset'),
	changelog: join(root, 'CHANGELOG.md'),
	appChangelog: join(root, 'packages/app/CHANGELOG.md'),
	appPackageJson: join(root, 'packages/app/package.json'),
	tauriConf: join(root, 'packages/app/src-tauri/tauri.conf.json'),
	cargoToml: join(root, 'packages/app/src-tauri/Cargo.toml'),
	pocketbaseChangelog: join(root, 'packages/pocketbase/CHANGELOG.md'),
	pocketbasePackageJson: join(root, 'packages/pocketbase/package.json')
};

/** Reads and parses every pending changeset file. */
function readAllChangesets() {
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

		changesets.push({ file, fullPath, bumps, summary: body.trim() });
	}

	return changesets;
}

function changesetsForPackage(changesets, packageName) {
	return changesets
		.filter((changeset) => changeset.bumps[packageName])
		.map((changeset) => ({
			...changeset,
			bump: changeset.bumps[packageName]
		}));
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

function highestBump(changesets) {
	return changesets
		.map((changeset) => changeset.bump)
		.reduce((highest, current) => (BUMP_RANK[current] > BUMP_RANK[highest] ? current : highest));
}

/** tauri.conf.json is the source of truth for the app version. */
function readAppVersion() {
	const conf = JSON.parse(readFileSync(paths.tauriConf, 'utf8'));
	if (!conf.version) {
		throw new Error('No "version" found in tauri.conf.json');
	}
	return conf.version;
}

function readPocketbaseVersion() {
	const pkg = JSON.parse(readFileSync(paths.pocketbasePackageJson, 'utf8'));
	if (!pkg.version) {
		throw new Error('No "version" found in packages/pocketbase/package.json');
	}
	return pkg.version;
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

function prependPackageChangelog(packageName, changelogPath, newVersion, bullets) {
	const title = `# ${packageName}`;
	const entry = `## ${newVersion}\n\n${bullets.join('\n')}`;

	let previous = '';
	if (existsSync(changelogPath)) {
		const existing = readFileSync(changelogPath, 'utf8').replace(/^\uFEFF/, '');
		previous = existing.replace(/^#\s+.*(\r?\n)+/, '').trim();
	}

	const content = previous ? `${title}\n\n${entry}\n\n${previous}\n` : `${title}\n\n${entry}\n`;

	writeFileSync(changelogPath, content);
}

function versionApp(appChangesets) {
	const bump = highestBump(appChangesets);
	const currentVersion = readAppVersion();
	const newVersion = bumpVersion(currentVersion, bump);
	const bullets = toBullets(appChangesets);

	if (DRY_RUN) {
		console.log(`[dry-run] app ${currentVersion} -> ${newVersion} (${bump})`);
		console.log('[dry-run] Would sync version in package.json, tauri.conf.json, Cargo.toml.');
		console.log(`[dry-run] Would prepend to CHANGELOG.md:\n`);
		console.log(`### v${newVersion}\n\n${bullets.join('\n')}\n`);
		console.log(`[dry-run] Would prepend to packages/app/CHANGELOG.md:\n`);
		console.log(`## ${newVersion}\n\n${bullets.join('\n')}\n`);
		return;
	}

	replaceFirst(paths.appPackageJson, /("version":\s*")[^"]+(")/, `$1${newVersion}$2`);
	replaceFirst(paths.tauriConf, /("version":\s*")[^"]+(")/, `$1${newVersion}$2`);
	writeCargoVersion(newVersion);
	prependChangelog(newVersion, bullets);
	prependPackageChangelog(APP_PACKAGE, paths.appChangelog, newVersion, bullets);

	console.log(`Bumped app ${currentVersion} -> ${newVersion} (${bump})`);
}

function versionPocketbase(pocketbaseChangesets) {
	const bump = highestBump(pocketbaseChangesets);
	const currentVersion = readPocketbaseVersion();
	const newVersion = bumpVersion(currentVersion, bump);
	const bullets = toBullets(pocketbaseChangesets);

	if (DRY_RUN) {
		console.log(`[dry-run] pocketbase ${currentVersion} -> ${newVersion} (${bump})`);
		console.log(`[dry-run] Would prepend to packages/pocketbase/CHANGELOG.md:\n`);
		console.log(`## ${newVersion}\n\n${bullets.join('\n')}\n`);
		return;
	}

	replaceFirst(
		paths.pocketbasePackageJson,
		/("version":\s*")[^"]+(")/,
		`$1${newVersion}$2`
	);
	prependPackageChangelog(
		POCKETBASE_PACKAGE,
		paths.pocketbaseChangelog,
		newVersion,
		bullets
	);

	console.log(`Bumped pocketbase ${currentVersion} -> ${newVersion} (${bump})`);
}

function main() {
	const allChangesets = readAllChangesets();
	const appChangesets = changesetsForPackage(allChangesets, APP_PACKAGE);
	const pocketbaseChangesets = changesetsForPackage(allChangesets, POCKETBASE_PACKAGE);

	if (appChangesets.length === 0 && pocketbaseChangesets.length === 0) {
		console.log('No versionable changesets found. Nothing to version.');
		return;
	}

	const toConsume = new Set();

	for (const changeset of allChangesets) {
		if (changeset.bumps[APP_PACKAGE] || changeset.bumps[POCKETBASE_PACKAGE]) {
			toConsume.add(changeset.fullPath);
		}
	}

	if (appChangesets.length > 0) {
		versionApp(appChangesets);
	}

	if (pocketbaseChangesets.length > 0) {
		versionPocketbase(pocketbaseChangesets);
	}

	if (DRY_RUN) {
		console.log(`[dry-run] Would consume: ${[...toConsume].map((path) => path.split('/').pop()).join(', ')}`);
		return;
	}

	for (const fullPath of toConsume) {
		rmSync(fullPath);
	}

	console.log(`Consumed ${toConsume.size} changeset(s).`);
}

main();
