import { EventEmitter } from 'eventemitter3';
import { createReadStream, statSync, type ReadStream, type Stats } from 'node:fs';
import { EOL } from 'node:os';

import config from './config.js';

export default class Watcher extends EventEmitter {
	private file: ReadStream | null = null; // Initialize to null

	private size = {
		prev: 0,
		current: 0
	};

	constructor() {
		super();

		setInterval(() => this.watch(), 1000);
	}

	private watch() {
		if (!config.pathToWarnings) {
			return;
		}

		try {
			const { size } = statSync(config.pathToWarnings);

			this.size.prev = this.size.current;
			this.size.current = size;

			if (this.size.current > this.size.prev) {
				this.file = createReadStream(config.pathToWarnings, {
					encoding: 'utf-8',
					start: this.size.prev,
					end: this.size.current - 1 // end is inclusive, adjust to read only new bytes
				});

				this.file.on('data', (data: string | Buffer) => {
					const str = typeof data === 'string' ? data : data.toString('utf-8');
					str.split(EOL).forEach((line) => line !== '' && this.emit('log:line', line));
				});

				// Handle potential errors during stream reading
				this.file.on('error', (err) => {
					console.error(`Error reading file ${config.pathToWarnings}:`, err);
					this.size.prev = 0; // Reset might be needed depending on error type
					this.size.current = 0;
				});
			}
		} catch (e: any) {
			if (e.code !== 'ENOENT') {
				// Avoid logging common "file not found" errors if desired
				console.error(`Error accessing file ${config.pathToWarnings}:`, e);
			}

			this.size.prev = 0;
			this.size.current = 0;

			if (this.file && !this.file.destroyed) {
				this.file.destroy(); // Ensure stream is closed if an error occurs before/during setup
				this.file = null;
			}
		}
	}
}

const watcher = new Watcher();

export { watcher };
