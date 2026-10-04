#!/usr/bin/env node
// Custom version step for every workspace package under `packages/*`.
//
// Consumes pending changesets in `.changeset/*.md`, bumps the version in each
// affected package.json and prepends the changeset summaries to that package's
// CHANGELOG.md in the standard changesets format (## X.Y.Z headings). Those
// per-package files are what `changesets/action` reads to build the "Version
// Packages" PR body.
//
// Tauri apps (the companion app and the replay parser) are special-cased:
// tauri.conf.json is the source of truth for their version and Cargo.toml is
// kept in sync. The companion app's summaries are also prepended to the root
// CHANGELOG.md in the format the in-app changelog dialog renders:
//
//   ### vX.Y.Z
//
//   - <summary>
//
// Run via `pnpm version-packages`. Pass `--dry-run` to preview the changes, or
// `--check` to print `true`/`false` depending on whether anything is versionable
// (used by the release workflow to skip the changesets action when there is
// nothing to release).

import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';

const APP_PACKAGE = '@company-of-heroes/app';
/** Tauri apps by package name → their `src-tauri` folder. */
const TAURI_PACKAGES = {
	[APP_PACKAGE]: 'packages/app/src-tauri',
	'@company-of-heroes/replay-parser': 'packages/replay-parser/src-tauri'
};
const BUMP_RANK = { patch: 1, minor: 2, major: 3 };
const DRY_RUN = process.argv.includes('--dry-run');
const CHECK_ONLY = process.argv.includes('--check');

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDir, '..');

const paths = {
	packagesDir: join(root, 'packages'),
	changesetDir: join(root, '.changeset'),
	changelog: join(root, 'CHANGELOG.md')
};

function tauriPaths(packageName) {
	const dir = TAURI_PACKAGES[packageName];
	return dir
		? { tauriConf: join(root, dir, 'tauri.conf.json'), cargoToml: join(root, dir, 'Cargo.toml') }
		: null;
}

/** Every package under `packages/*`, keyed by its package.json name. */
function readWorkspacePackages() {
	const packages = new Map();

	for (const entry of readdirSync(paths.packagesDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			continue;
		}

		const packageJsonPath = join(paths.packagesDir, entry.name, 'package.json');
		if (!existsSync(packageJsonPath)) {
			continue;
		}

		const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
		if (!pkg.name) {
			continue;
		}

		packages.set(pkg.name, {
			name: pkg.name,
			version: pkg.version,
			packageJsonPath,
			changelogPath: join(paths.packagesDir, entry.name, 'CHANGELOG.md')
		});
	}

	return packages;
}

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

/** tauri.conf.json is the source of truth for a Tauri app's version. */
function readTauriVersion(tauri) {
	const conf = JSON.parse(readFileSync(tauri.tauriConf, 'utf8'));
	if (!conf.version) {
		throw new Error('No "version" found in tauri.conf.json');
	}

	return conf.version;
}

function readCurrentVersion(pkg) {
	const tauri = tauriPaths(pkg.name);
	if (tauri) {
		return readTauriVersion(tauri);
	}

	if (!pkg.version) {
		throw new Error(`No "version" found in ${pkg.packageJsonPath}`);
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
function writeCargoVersion(cargoToml, newVersion) {
	const content = readFileSync(cargoToml, 'utf8');
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

	writeFileSync(cargoToml, lines.join('\n'));
}

/** Turns changeset bodies into CHANGELOG bullet lines. */
function toBullets(changesets) {
	const bullets = [];

	for (const changeset of changesets) {
		const lines = changeset.summary.split(/\r?\n/).map((line) => line.trim());

		for (const line of lines) {
			if (!line) {
				continue;
			}

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

function versionPackage(pkg, packageChangesets) {
	const bump = highestBump(packageChangesets);
	const currentVersion = readCurrentVersion(pkg);
	const newVersion = bumpVersion(currentVersion, bump);
	const bullets = toBullets(packageChangesets);
	const isApp = pkg.name === APP_PACKAGE;

	if (DRY_RUN) {
		console.log(`[dry-run] ${pkg.name} ${currentVersion} -> ${newVersion} (${bump})`);
		if (isApp) {
			console.log('[dry-run] Would sync version in package.json, tauri.conf.json, Cargo.toml.');
			console.log(`[dry-run] Would prepend to CHANGELOG.md:\n`);
			console.log(`### v${newVersion}\n\n${bullets.join('\n')}\n`);
		}

		console.log(`[dry-run] Would prepend to ${pkg.changelogPath}:\n`);
		console.log(`## ${newVersion}\n\n${bullets.join('\n')}\n`);
		return;
	}

	replaceFirst(pkg.packageJsonPath, /("version":\s*")[^"]+(")/, `$1${newVersion}$2`);

	if (tauri) {
		replaceFirst(tauri.tauriConf, /("version":\s*")[^"]+(")/, `$1${newVersion}$2`);
		writeCargoVersion(tauri.cargoToml, newVersion);
	}

	if (isApp) {
		prependChangelog(newVersion, bullets);
	}

	prependPackageChangelog(pkg.name, pkg.changelogPath, newVersion, bullets);

	console.log(`Bumped ${pkg.name} ${currentVersion} -> ${newVersion} (${bump})`);
}

function main() {
	const workspacePackages = readWorkspacePackages();
	const allChangesets = readAllChangesets();

	const releases = [];
	const unknownPackages = new Set();

	for (const changeset of allChangesets) {
		for (const packageName of Object.keys(changeset.bumps)) {
			if (!workspacePackages.has(packageName)) {
				unknownPackages.add(packageName);
			}
		}
	}

	for (const pkg of workspacePackages.values()) {
		const packageChangesets = changesetsForPackage(allChangesets, pkg.name);
		if (packageChangesets.length > 0) {
			releases.push({ pkg, changesets: packageChangesets });
		}
	}

	if (CHECK_ONLY) {
		console.log(releases.length > 0 ? 'true' : 'false');
		return;
	}

	for (const packageName of unknownPackages) {
		console.warn(
			`Warning: changeset targets "${packageName}", which is not a package under packages/*. It will be left in place.`
		);
	}

	if (releases.length === 0) {
		console.log('No versionable changesets found. Nothing to version.');
		return;
	}

	const toConsume = new Set();

	for (const release of releases) {
		for (const changeset of release.changesets) {
			toConsume.add(changeset.fullPath);
		}
	}

	for (const release of releases) {
		versionPackage(release.pkg, release.changesets);
	}

	if (DRY_RUN) {
		console.log(
			`[dry-run] Would consume: ${[...toConsume].map((path) => basename(path)).join(', ')}`
		);
		return;
	}

	for (const fullPath of toConsume) {
		rmSync(fullPath);
	}

	console.log(`Consumed ${toConsume.size} changeset(s).`);
}

main();
