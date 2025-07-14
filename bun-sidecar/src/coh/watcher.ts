import { EventEmitter } from 'eventemitter3';
import { createReadStream, statSync, type ReadStream, type Stats } from 'node:fs';
import { EOL } from 'node:os';

export class Watcher extends EventEmitter {
	/**
	 * The file stream for reading the log file.
	 *
	 * @type {ReadStream | null}
	 * @private
	 */
	private file: ReadStream | null = null; // Initialize to null

	/**
	 * Tracks the size of the file being watched.
	 *
	 * @type {{ prev: number; current: number }}
	 * @private
	 */
	private size = {
		prev: 0,
		current: 0
	};

	/**
	 * Interval for the watcher to check the file.
	 *
	 * @type {NodeJS.Timeout | null}
	 * @private
	 */
	private interval: NodeJS.Timeout | null = null;

	/**
	 * Creates an instance of Watcher.
	 * @param path The absolute path to the file to watch.
	 */
	constructor(readonly path: string) {
		super();
	}

	/**
	 * Checks the file for size changes and reads new content if the file has grown.
	 * Emits 'log:line' events for each new line read.
	 * Handles errors during file access and reading.
	 */
	private watch() {
		try {
			const { size } = statSync(this.path);

			this.size.prev = this.size.current;
			this.size.current = size;

			if (this.size.current > this.size.prev) {
				this.file = createReadStream(this.path, {
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
					console.error(`Error reading file ${this.path}:`, err);
					this.size.prev = 0; // Reset might be needed depending on error type
					this.size.current = 0;
				});
			} else if (this.size.current < this.size.prev) {
				console.log('Hi');
				this.stop();
				this.start();
			}
		} catch (e: any) {
			if (e.code !== 'ENOENT') {
				// Avoid logging common "file not found" errors if desired
				console.error(`Error accessing file ${this.path}:`, e);
			}

			this.size.prev = 0;
			this.size.current = 0;

			if (this.file && !this.file.destroyed) {
				this.file.destroy(); // Ensure stream is closed if an error occurs before/during setup
				this.file = null;
			}
		}
	}

	/**
	 * Starts the watcher interval, checking the file for changes every second.
	 */
	start() {
		this.interval = setInterval(() => this.watch(), 1000);
	}

	/**
	 * Stops the watcher interval, cleans up resources (interval, file stream),
	 * and removes all event listeners. Resets file size tracking.
	 */
	stop() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}

		if (this.file && !this.file.destroyed) {
			this.file.destroy();
			this.file = null;
		}

		this.removeAllListeners();
		this.size.prev = 0;
		this.size.current = 0;
	}
}
