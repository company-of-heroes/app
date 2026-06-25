import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogTailer } from './tailer';
import { __fs } from '@tauri-apps/plugin-fs';

const LOG = 'C:/Users/test/Documents/My Games/Company of Heroes Relaunch/warnings.log';

describe('LogTailer', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		__fs.reset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function makeTailer() {
		const received: string[][] = [];
		const truncations: number[] = [];
		const errors: unknown[] = [];

		const tailer = new LogTailer({
			onLines: (lines) => {
				received.push(lines);
			},
			onTruncated: () => {
				truncations.push(Date.now());
			},
			onError: (error) => {
				errors.push(error);
			}
		});

		return { tailer, received, truncations, errors };
	}

	it('reads the existing content on the first poll', async () => {
		__fs.setFile(LOG, 'line one\nline two\n');
		const { tailer, received } = makeTailer();

		tailer.start(LOG);
		await tailer.poll();
		tailer.stop();

		expect(received).toEqual([['line one', 'line two']]);
	});

	it('only reads appended lines on subsequent polls', async () => {
		__fs.setFile(LOG, 'first\n');
		const { tailer, received } = makeTailer();

		tailer.start(LOG);
		await tailer.poll();

		__fs.append(LOG, 'second\nthird\n');
		await tailer.poll();
		tailer.stop();

		expect(received).toEqual([['first'], ['second', 'third']]);
	});

	it('buffers incomplete lines until terminated', async () => {
		__fs.setFile(LOG, 'complete\nincomp');
		const { tailer, received } = makeTailer();

		tailer.start(LOG);
		await tailer.poll();

		expect(received).toEqual([['complete']]);

		__fs.append(LOG, 'lete now\n');
		await tailer.poll();
		tailer.stop();

		expect(received).toEqual([['complete'], ['incomplete now']]);
	});

	it('handles CRLF line endings', async () => {
		__fs.setFile(LOG, 'one\r\ntwo\r\n');
		const { tailer, received } = makeTailer();

		tailer.start(LOG);
		await tailer.poll();
		tailer.stop();

		expect(received).toEqual([['one', 'two']]);
	});

	it('detects truncation and re-reads from the start', async () => {
		__fs.setFile(LOG, 'old session line one\nold session line two\n');
		const { tailer, received, truncations } = makeTailer();

		tailer.start(LOG);
		await tailer.poll();

		// Game restarted: log truncated and rewritten with shorter content.
		__fs.setFile(LOG, 'new session\n');
		await tailer.poll();
		tailer.stop();

		expect(truncations).toHaveLength(1);
		expect(received).toEqual([['old session line one', 'old session line two'], ['new session']]);
	});

	it('reports missing files via onError and keeps polling', async () => {
		const { tailer, errors, received } = makeTailer();

		tailer.start(LOG);
		await tailer.poll();

		expect(errors).toHaveLength(1);

		__fs.setFile(LOG, 'appeared\n');
		await tailer.poll();
		tailer.stop();

		expect(received).toEqual([['appeared']]);
	});

	it('does nothing when the file has not grown', async () => {
		__fs.setFile(LOG, 'same\n');
		const { tailer, received } = makeTailer();

		tailer.start(LOG);
		await tailer.poll();
		await tailer.poll();
		await tailer.poll();
		tailer.stop();

		expect(received).toEqual([['same']]);
	});
});
