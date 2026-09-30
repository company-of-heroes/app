#!/usr/bin/env node
// Golden snapshots for the pb_hooks -> website migration.
//
//   node scripts/golden/golden.mjs record             store legacy responses in scripts/golden/snapshots/
//   node scripts/golden/golden.mjs compare [name...]  fetch again (via BASE_URL) and diff against the snapshots
//
// BASE_URL defaults to https://api.coh1stats.com. After a route is moved behind the
// api-gateway, `compare` against the same URL proves the new implementation answers identically.
// Set AUTH_TOKEN to send a PocketBase user token for user-scoped cases.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const snapshotDir = join(here, 'snapshots');
const baseUrl = (process.env.BASE_URL ?? 'https://api.coh1stats.com').replace(/\/$/, '');

const { vars, cases } = JSON.parse(await readFile(join(here, 'cases.json'), 'utf8'));
const [mode, ...only] = process.argv.slice(2);

function resolvePath(path) {
	return path.replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(vars[key] ?? ''));
}

async function fetchCase(testCase) {
	const url = `${baseUrl}${resolvePath(testCase.legacy)}`;
	const headers = process.env.AUTH_TOKEN ? { authorization: process.env.AUTH_TOKEN } : {};
	const response = await fetch(url, { headers });
	const text = await response.text();
	let body;
	try {
		body = JSON.parse(text);
	} catch {
		body = text;
	}
	return { status: response.status, body };
}

// Stable JSON: sorted keys so reordering alone is not a diff.
function canonical(value) {
	if (Array.isArray(value)) {
		return value.map(canonical);
	}

	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, canonical(value[key])])
		);
	}

	return value;
}

function diff(expected, actual, path = '$', out = []) {
	if (out.length >= 20) {
		return out;
	}

	if (typeof expected !== typeof actual || Array.isArray(expected) !== Array.isArray(actual)) {
		out.push(
			`${path}: ${JSON.stringify(expected)?.slice(0, 80)} -> ${JSON.stringify(actual)?.slice(0, 80)}`
		);
		return out;
	}

	if (expected && typeof expected === 'object') {
		const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
		for (const key of keys) {
			diff(expected[key], actual[key], `${path}.${key}`, out);
		}
		return out;
	}

	if (expected !== actual) {
		out.push(`${path}: ${JSON.stringify(expected)} -> ${JSON.stringify(actual)}`);
	}

	return out;
}

const selected = cases.filter((c) => !only.length || only.includes(c.name));
await mkdir(snapshotDir, { recursive: true });

if (mode === 'record') {
	for (const testCase of selected) {
		const result = await fetchCase(testCase);
		await writeFile(
			join(snapshotDir, `${testCase.name}.json`),
			JSON.stringify(canonical(result), null, '\t')
		);
		console.log(`recorded ${testCase.name} (${result.status})`);
	}
} else if (mode === 'compare') {
	let failed = 0;
	for (const testCase of selected) {
		const expected = JSON.parse(await readFile(join(snapshotDir, `${testCase.name}.json`), 'utf8'));
		const actual = canonical(await fetchCase(testCase));
		const differences = diff(expected, actual);
		if (!differences.length) {
			console.log(`ok    ${testCase.name}`);
		} else if (testCase.volatile) {
			console.log(`skip  ${testCase.name} (volatile, ${differences.length} diffs)`);
		} else {
			failed++;
			console.log(`FAIL  ${testCase.name}\n      ${differences.join('\n      ')}`);
		}
	}
	process.exitCode = failed ? 1 : 0;
} else {
	console.log('usage: golden.mjs record|compare [case...]');
	process.exitCode = 2;
}
