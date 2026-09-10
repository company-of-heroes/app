#!/usr/bin/env node
/**
 * Fully reparse all (or one) `replays` collection records with @fknoobs/replay-parser.
 *
 * Requires in .env (cwd): PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, optional PB_URL
 * (default http://127.0.0.1:8090).
 *
 * Usage:
 *   pnpm replays:reparse
 *   pnpm replays:reparse --dry-run
 *   pnpm replays:reparse --id=RECORD_ID
 *   pnpm replays:reparse --concurrency=24
 *   pnpm replays:reparse --header-only   # much faster; skips messages/duration/doctrine IDs
 *   pnpm replays:reparse --force         # rewrite all fields even when unchanged
 */
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';

// @fknoobs/replay-parser dist uses extensionless relative imports; Node ESM requires .js.
registerHooks({
	resolve(specifier, context, nextResolve) {
		if (
			context.parentURL &&
			(specifier.startsWith('./') || specifier.startsWith('../')) &&
			!path.extname(specifier)
		) {
			const candidate = path.join(path.dirname(fileURLToPath(context.parentURL)), `${specifier}.js`);
			if (existsSync(candidate)) {
				return nextResolve(`${specifier}.js`, context);
			}
		}
		return nextResolve(specifier, context);
	}
});

const { parseReplay, parseHeader, formatTickTimestamp } = await import('@fknoobs/replay-parser');

dotenv.config();
const adminEmail = process.env.PB_ADMIN_EMAIL;
const adminPassword = process.env.PB_ADMIN_PASSWORD;
const baseUrl = normalizeBaseUrl(process.env.PB_URL ?? 'http://127.0.0.1:8090');
const dryRun = process.argv.includes('--dry-run');
const headerOnly = process.argv.includes('--header-only');
const force = process.argv.includes('--force');
const onlyId = process.argv
	.filter((arg) => arg.startsWith('--id='))
	.map((arg) => arg.split('=')[1])
	.find(Boolean);
const concurrency = Math.max(
	1,
	Number(
		process.argv
			.filter((arg) => arg.startsWith('--concurrency='))
			.map((arg) => arg.split('=')[1])
			.find(Boolean) ?? 16
	) || 16
);
const PAGE_SIZE = 200;
// Omit messages from list payloads (often large); always refresh them on full parse.
const RECORD_FIELDS = [
	'id',
	'collectionId',
	'collectionName',
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
	'vpCount',
	'players'
].join(',');

if (!adminEmail || !adminPassword) {
	throw new Error('PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD must be set in .env');
}

const client = new PocketBase(baseUrl);
client.autoCancellation(false);
await client.collection('_superusers').authWithPassword(adminEmail, adminPassword);
console.log(
	`Authenticated against ${baseUrl} (dryRun=${dryRun}, headerOnly=${headerOnly}, force=${force}, concurrency=${concurrency})`
);

let updated = 0;
let skipped = 0;
let failed = 0;
let processed = 0;
let total = 0;
const startedAt = Date.now();

if (onlyId) {
	const record = await client.collection('replays').getOne(onlyId, { fields: RECORD_FIELDS });
	total = 1;
	console.log(`Found 1 replay to process (id=${onlyId}).`);
	await processOne(record);
} else {
	let page = 1;
	for (;;) {
		const result = await client.collection('replays').getList(page, PAGE_SIZE, {
			fields: RECORD_FIELDS,
			sort: 'id',
			requestKey: null
		});
		if (page === 1) {
			total = result.totalItems;
			console.log(`Found ${total} replay(s) to process.`);
		}
		if (result.items.length === 0) break;

		await mapPool(result.items, concurrency, processOne);

		if (page >= result.totalPages) break;
		page += 1;
	}
}

const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(
	`Done in ${elapsedSec}s. total=${total}, updated=${updated}, skipped=${skipped}, failed=${failed}`
);

async function mapPool(items, limit, fn) {
	let next = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (next < items.length) {
			const index = next++;
			await fn(items[index]);
		}
	});
	await Promise.all(workers);
}

async function processOne(record) {
	try {
		const change = await processReplay(record);
		if (change) updated += 1;
		else skipped += 1;
	} catch (err) {
		failed += 1;
		console.error(`Replay ${record.id} failed:`, err?.message ?? err);
	} finally {
		processed += 1;
		if (processed % 50 === 0 || processed === total) {
			logProgress();
		}
	}
}

function logProgress() {
	const elapsedMs = Date.now() - startedAt;
	const rate = processed / Math.max(elapsedMs / 1000, 0.001);
	const remaining = Math.max(total - processed, 0);
	const etaSec = rate > 0 ? remaining / rate : 0;
	console.log(
		`Progress ${processed}/${total} (${((processed / Math.max(total, 1)) * 100).toFixed(1)}%) ` +
			`updated=${updated} skipped=${skipped} failed=${failed} ` +
			`${rate.toFixed(1)}/s eta=${formatEta(etaSec)}`
	);
}

function formatEta(seconds) {
	const s = Math.max(0, Math.round(seconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const rem = s % 60;
	if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
	if (m > 0) return `${m}m${String(rem).padStart(2, '0')}s`;
	return `${rem}s`;
}

async function processReplay(record) {
	if (!record.file) {
		return false;
	}

	const url = safeFileUrl(record);
	if (!url) {
		throw new Error('invalid file URL');
	}

	const res = await fetch(url, {
		headers: {
			Authorization: client.authStore.token
		}
	});
	if (!res.ok) {
		throw new Error(`Download failed with ${res.status}`);
	}

	const buffer = new Uint8Array(await res.arrayBuffer());
	const replay = headerOnly ? parseHeader(buffer) : parseReplay(buffer);
	const payload = buildPayloadFromReplay(replay, record);
	const hasChanges = Object.keys(payload).length > 0;

	if (!hasChanges) {
		return false;
	}

	if (dryRun) {
		console.log(`[dry-run] Would update replay ${record.id}:`, summarizePayload(payload));
		return true;
	}

	await client.collection('replays').update(record.id, payload, { requestKey: null });
	console.log(`Updated replay ${record.id}:`, Object.keys(payload).join(', '));
	return true;
}

function flattenParsedReplay(replay) {
	const header = replay.header ?? {};
	return {
		replayName: header.replayName ?? '',
		matchType: header.matchType ?? '',
		mapName: header.mapName ?? '',
		mapFileName: header.mapFileName ?? '',
		highResources: header.highResources,
		randomStart: header.randomStart,
		vpGame: header.vpGame,
		vpCount: header.vpCount,
		gameDate: header.gameDate ?? '',
		duration: replay.durationSeconds ?? 0,
		players: replay.players ?? [],
		messages: (replay.chat ?? []).map((message) => ({
			playerID: message.playerId,
			sender: message.sender,
			recipient: message.recipient,
			timestamp: formatTickTimestamp(message.tick),
			content: message.content,
			tick: message.tick
		}))
	};
}

function buildPayloadFromReplay(parsed, existing) {
	const replay = flattenParsedReplay(parsed);
	const title = !replay.replayName ? '-' : replay.replayName;
	const isRanked = replay.matchType?.toLowerCase().includes('automatch') ?? false;
	const next = {
		title,
		isRanked,
		mapName: replay.mapName || existing.mapName,
		mapFilename: replay.mapFileName || existing.mapFilename,
		isHighResources: typeof replay.highResources === 'boolean' ? replay.highResources : existing.isHighResources,
		isRandomStart: typeof replay.randomStart === 'boolean' ? replay.randomStart : existing.isRandomStart,
		isVpGame: typeof replay.vpGame === 'boolean' ? replay.vpGame : existing.isVpGame,
		vpCount: typeof replay.vpCount === 'number' ? replay.vpCount : existing.vpCount,
		players: replay.players
	};

	if (replay.gameDate) {
		const iso = toIsoString(replay.gameDate);
		if (iso) next.gameDate = iso;
	}
	if (typeof replay.duration === 'number' && replay.duration > 0) {
		next.durationInSeconds = replay.duration;
	}
	if (!headerOnly) {
		next.messages = replay.messages ?? [];
	}

	if (force) {
		const payload = {
			title: next.title,
			isRanked: next.isRanked,
			mapName: next.mapName,
			mapFilename: next.mapFilename,
			isHighResources: next.isHighResources,
			isRandomStart: next.isRandomStart,
			isVpGame: next.isVpGame,
			vpCount: next.vpCount,
			players: next.players
		};
		if (next.gameDate) payload.gameDate = next.gameDate;
		if (typeof next.durationInSeconds === 'number') payload.durationInSeconds = next.durationInSeconds;
		if (!headerOnly) payload.messages = next.messages;
		return payload;
	}

	const payload = {};
	if (next.gameDate && next.gameDate !== toIsoString(existing.gameDate)) payload.gameDate = next.gameDate;
	if (
		typeof next.durationInSeconds === 'number' &&
		next.durationInSeconds !== existing.durationInSeconds
	) {
		payload.durationInSeconds = next.durationInSeconds;
	}
	if (next.mapName && next.mapName !== existing.mapName) payload.mapName = next.mapName;
	if (next.mapFilename && next.mapFilename !== existing.mapFilename) {
		payload.mapFilename = next.mapFilename;
	}
	if (next.title !== existing.title) payload.title = next.title;
	if (next.isHighResources !== existing.isHighResources) payload.isHighResources = next.isHighResources;
	if (next.isRandomStart !== existing.isRandomStart) payload.isRandomStart = next.isRandomStart;
	if (next.isRanked !== Boolean(existing.isRanked)) payload.isRanked = next.isRanked;
	if (next.isVpGame !== existing.isVpGame) payload.isVpGame = next.isVpGame;
	if (next.vpCount !== existing.vpCount) payload.vpCount = next.vpCount;
	if (!jsonEqual(next.players, existing.players)) payload.players = next.players;
	// Messages aren't listed (too large); refresh them when something else already changed.
	if (!headerOnly && Object.keys(payload).length > 0) {
		payload.messages = next.messages;
	}

	return payload;
}

function jsonEqual(a, b) {
	return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function summarizePayload(payload) {
	const summary = { ...payload };
	if (summary.players) summary.players = `[${Array.isArray(summary.players) ? summary.players.length : '?'} players]`;
	if (summary.messages) {
		summary.messages = `[${Array.isArray(summary.messages) ? summary.messages.length : '?'} messages]`;
	}
	return summary;
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
		let url = client.files.getURL(record, record.file);
		if (!url) {
			url = `${baseUrl}/api/files/replays/${record.id}/${encodeURIComponent(record.file)}`;
		}
		return new URL(url, baseUrl).href;
	} catch (err) {
		console.warn(`Could not build URL for replay ${record.id}: ${err?.message ?? err}`);
		return null;
	}
}
