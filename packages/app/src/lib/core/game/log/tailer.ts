import { open, readTextFile, stat, SeekMode } from '@tauri-apps/plugin-fs';

/**
 * Polling file tailer for warnings.log.
 *
 * Reads only the bytes appended since the previous poll (byte-offset based,
 * via open/seek/read) instead of re-reading the whole file. Detects log
 * truncation (the game truncates warnings.log on restart) and resets cleanly.
 * Falls back to whole-file reads when streaming reads are unavailable.
 */

export type TailerOptions = {
	/** Poll interval in ms (default 500). */
	intervalMs?: number;
	/** Called with complete, non-empty lines appended to the file. */
	onLines: (lines: string[]) => void | Promise<void>;
	/** Called when the file shrank (log restarted). State should be reset. */
	onTruncated?: () => void | Promise<void>;
	/** Called once after every poll cycle completes (used for readiness). */
	onTick?: () => void;
	onError?: (error: unknown) => void;
};

export class LogTailer {
	#path = '';
	#offset = 0;
	#carry = '';
	#decoder = new TextDecoder();
	#timer: ReturnType<typeof setInterval> | null = null;
	#ticking = false;
	#useFallback = false;
	#options: TailerOptions;

	constructor(options: TailerOptions) {
		this.#options = options;
	}

	get isRunning(): boolean {
		return this.#timer !== null;
	}

	start(path: string): void {
		this.stop();

		this.#path = path;
		this.#reset();

		const interval = this.#options.intervalMs ?? 500;

		this.#timer = setInterval(() => void this.#tick(), interval);
	}

	stop(): void {
		if (this.#timer) {
			clearInterval(this.#timer);
			this.#timer = null;
		}

		this.#reset();
	}

	#reset(): void {
		this.#offset = 0;
		this.#carry = '';
		this.#decoder = new TextDecoder();
	}

	/** Exposed for tests: performs a single poll cycle. */
	async poll(): Promise<void> {
		await this.#tick();
	}

	async #tick(): Promise<void> {
		if (this.#ticking) {
			return;
		}

		this.#ticking = true;

		try {
			const info = await stat(this.#path);

			// Truncation: the game restarted and rewrote the log.
			if (info.size < this.#offset) {
				this.#reset();
				await this.#options.onTruncated?.();
			}

			if (info.size > this.#offset) {
				const text = this.#useFallback
					? await this.#readAppendedFallback(info.size)
					: await this.#readAppended(info.size);

				if (text !== null) {
					await this.#processChunk(text);
					this.#offset = info.size;
				}
			}

			this.#options.onTick?.();
		} catch (error) {
			this.#options.onError?.(error);
		} finally {
			this.#ticking = false;
		}
	}

	async #readAppended(size: number): Promise<string | null> {
		try {
			const file = await open(this.#path, { read: true });

			try {
				if (this.#offset > 0) {
					await file.seek(this.#offset, SeekMode.Start);
				}

				const length = size - this.#offset;
				const chunks: Uint8Array[] = [];
				let remaining = length;

				while (remaining > 0) {
					const buffer = new Uint8Array(Math.min(remaining, 64 * 1024));
					const read = await file.read(buffer);

					if (read === null || read === 0) {
						break;
					}

					chunks.push(buffer.subarray(0, read));
					remaining -= read;
				}

				let decoded = '';

				for (const [index, chunk] of chunks.entries()) {
					decoded += this.#decoder.decode(chunk, { stream: index < chunks.length - 1 });
				}

				return decoded;
			} finally {
				await file.close();
			}
		} catch (error) {
			// Streaming read unsupported/failed: switch to whole-file fallback.
			console.warn('[LOG]: streaming read failed, using fallback:', error);
			this.#useFallback = true;
			return this.#readAppendedFallback(size);
		}
	}

	async #readAppendedFallback(_size: number): Promise<string | null> {
		const content = await readTextFile(this.#path);

		// Byte offsets and char offsets differ for multi-byte content; track
		// the processed prefix by encoded length to stay consistent.
		const encoder = new TextEncoder();
		const bytes = encoder.encode(content);

		if (bytes.length <= this.#offset) {
			return null;
		}

		return new TextDecoder().decode(bytes.subarray(this.#offset));
	}

	async #processChunk(text: string): Promise<void> {
		const combined = this.#carry + text;
		const parts = combined.split(/\r\n|\r|\n/);

		// The last element is either an incomplete line or an empty string.
		this.#carry = parts.pop() ?? '';

		const lines = parts.filter((line) => line.trim() !== '');

		if (lines.length > 0) {
			await this.#options.onLines(lines);
		}
	}
}
