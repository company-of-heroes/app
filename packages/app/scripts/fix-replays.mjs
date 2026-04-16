#!/usr/bin/env node
import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';

// Ensure Node uses extensionless resolution to satisfy the parser's ESM build.
const SPECIFIER_FLAG = '--experimental-specifier-resolution=node';
if (!process.execArgv.includes(SPECIFIER_FLAG)) {
	const { spawn } = await import('node:child_process');
	const child = spawn(process.argv[0], [SPECIFIER_FLAG, ...process.argv.slice(1)], {
		stdio: 'inherit',
		env: process.env
	});
	child.on('exit', (code, signal) => {
		process.exit(code ?? (signal ? 1 : 0));
	});
}

const { parseHeader } = await import('@fknoobs/replay-parser');

const env = dotenv.config().parsed ?? {};
const adminEmail = env.PB_ADMIN_EMAIL;
const adminPassword = env.PB_ADMIN_PASSWORD;
const baseUrl = normalizeBaseUrl(env.PB_URL ?? 'http://127.0.0.1:8090');
const dryRun = process.argv.includes('--dry-run');
const onlyId = process.argv
	.filter((arg) => arg.startsWith('--id='))
	.map((arg) => arg.split('=')[1])
	.find(Boolean);

if (!adminEmail || !adminPassword) {
	throw new Error('PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD must be set in .env');
}

const client = new PocketBase(baseUrl);
await client.collection('_superusers').authWithPassword(adminEmail, adminPassword);
console.log(`Authenticated against ${baseUrl} (dryRun=${dryRun})`);

const replays = await client.collection('replays').getFullList(20000, {
	fields: [
		'id',
		'file',
		'filename',
		'gameDate',
		'durationInSeconds',
		'mapName',
		'mapFilename',
		'title',
		'isHighResources',
		'isRandomStart',
		'isRanked',
		'isVpGame',
		'vpCount'
	].join(','),
	filter: onlyId ? `id = "${onlyId}"` : undefined
});

console.log(`Found ${replays.length} replay(s) to process${onlyId ? ` (id=${onlyId})` : ''}.`);

let updated = 0;
let skipped = 0;
let failed = 0;

for (const replay of replays) {
	try {
		const change = await processReplay(replay);
		if (change) updated += 1;
		else skipped += 1;
	} catch (err) {
		failed += 1;
		console.error(`Replay ${replay.id} failed:`, err?.message ?? err);
	}
}

console.log(`Done. updated=${updated}, skipped=${skipped}, failed=${failed}`);

async function processReplay(record) {
	if (!record.file) {
		console.warn(`Replay ${record.id} has no file; skipping.`);
		return false;
	}

	const url = `http://127.0.0.1:8090/api/files/replays/${record.id}/${record.file}`;
	if (!url) {
		console.warn(`Replay ${record.id} has invalid file URL; skipping.`);
		return false;
	}
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Download failed with ${res.status}`);
	}
	const buffer = new Uint8Array(await res.arrayBuffer());
	const header = await parseHeader(buffer);

	const payload = buildPayloadFromHeader(header, record);
	const hasChanges = Object.keys(payload).length > 0;

	if (!hasChanges) {
		return false;
	}

	if (dryRun) {
		console.log(`[dry-run] Would update replay ${record.id}:`, payload);
		return true;
	}

	await client.collection('replays').update(record.id, payload);
	console.log(`Updated replay ${record.id}`);
	return true;
}

function buildPayloadFromHeader(header, existing) {
	const {
		gameDate,
		durationInSeconds,
		mapName,
		mapFilename,
		title,
		isHighResources,
		isRandomStart,
		isRanked,
		isVpGame,
		vpCount
	} = header ?? {};

	const payload = {};

	if (gameDate) {
		const iso = toIsoString(gameDate);
		if (iso && iso !== existing.gameDate) payload.gameDate = iso;
	}
	if (typeof durationInSeconds === 'number' && durationInSeconds !== existing.durationInSeconds) {
		payload.durationInSeconds = durationInSeconds;
	}
	if (mapName && mapName !== existing.mapName) payload.mapName = mapName;
	if (mapFilename && mapFilename !== existing.mapFilename) payload.mapFilename = mapFilename;
	if (title && title !== existing.title) payload.title = title;
	if (typeof isHighResources === 'boolean' && isHighResources !== existing.isHighResources) {
		payload.isHighResources = isHighResources;
	}
	if (typeof isRandomStart === 'boolean' && isRandomStart !== existing.isRandomStart) {
		payload.isRandomStart = isRandomStart;
	}
	if (typeof isRanked === 'boolean' && isRanked !== existing.isRanked) {
		payload.isRanked = isRanked;
	}
	if (typeof isVpGame === 'boolean' && isVpGame !== existing.isVpGame) {
		payload.isVpGame = isVpGame;
	}
	if (typeof vpCount === 'number' && vpCount !== existing.vpCount) {
		payload.vpCount = vpCount;
	}

	return payload;
}

function toIsoString(value) {
	if (!value) return null;
	if (value instanceof Date) return value.toISOString();
	if (typeof value === 'number') return new Date(value).toISOString();
	if (typeof value === 'string') {
		const dt = new Date(value);
		return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
	}
	return null;
}

function normalizeBaseUrl(url) {
	if (!url) return 'http://127.0.0.1:8090';
	if (/^https?:\/\//i.test(url)) return url;
	return `http://${url}`;
}

function safeFileUrl(record) {
	try {
		const url = client.files.getURL(record, record.file);
		// Ensure URL constructor can parse
		new URL(url);
		return url;
	} catch (err) {
		console.warn(`Could not build URL for replay ${record.id}: ${err?.message ?? err}`);
		return null;
	}
}
