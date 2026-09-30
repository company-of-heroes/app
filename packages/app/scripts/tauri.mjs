#!/usr/bin/env node
/**
 * Loads the updater signing key for local `tauri build` when CI secrets
 * are not present. `tauri build` reads `TAURI_SIGNING_PRIVATE_KEY` (file
 * path or key contents). `TAURI_SIGNING_PRIVATE_KEY_PATH` is only used by
 * `tauri signer sign`.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

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

const require = createRequire(import.meta.url);
const cli = require.resolve('@tauri-apps/cli/tauri.js');
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
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
