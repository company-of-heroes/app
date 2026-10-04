#!/usr/bin/env node
/**
 * `tauri dev` with the first free port from 1430 up, so it runs next to the companion app
 * (1420) or a leftover dev server. Vite reads `REPLAY_PARSER_PORT`; Tauri gets the matching
 * `devUrl` through a `--config` override. Other commands pass straight through.
 *
 * Also loads the updater signing key for local `tauri build` when CI secrets are not set
 * (same key and location as the companion app, see packages/app/scripts/tauri.mjs).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';

const FIRST_PORT = 1430;
const DEFAULT_KEY = join(homedir(), '.tauri', 'coh-companion.key');

if (!process.env.TAURI_SIGNING_PRIVATE_KEY) {
	const keyPath = process.env.TAURI_SIGNING_PRIVATE_KEY_PATH || DEFAULT_KEY;
	if (existsSync(keyPath)) {
		process.env.TAURI_SIGNING_PRIVATE_KEY = keyPath;
	}
}

if (
	process.env.TAURI_SIGNING_PRIVATE_KEY &&
	process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD === undefined
) {
	process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '';
}

function isFree(port) {
	return new Promise((resolve) => {
		const server = createServer()
			.once('error', () => resolve(false))
			.once('listening', () => server.close(() => resolve(true)))
			.listen(port, 'localhost');
	});
}

async function freePort(from) {
	for (let port = from; port < from + 100; port += 2) {
		// The port above is for HMR when TAURI_DEV_HOST is set.
		if ((await isFree(port)) && (await isFree(port + 1))) {
			return port;
		}
	}

	throw new Error(`No free port found from ${from}`);
}

const args = process.argv.slice(2);
if (args[0] === 'dev') {
	const port = await freePort(FIRST_PORT);
	process.env.REPLAY_PARSER_PORT = String(port);
	args.push('--config', JSON.stringify({ build: { devUrl: `http://localhost:${port}` } }));
	console.log(`[replay-parser] dev server on port ${port}`);
}

const require = createRequire(import.meta.url);
const cli = require.resolve('@tauri-apps/cli/tauri.js');
const child = spawn(process.execPath, [cli, ...args], {
	stdio: 'inherit',
	env: process.env
});

child.on('exit', (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
	} else {
		process.exit(code ?? 1);
	}
});
