import { beforeEach, describe, expect, it } from 'vitest';
import { readJsonWithRecovery, writeJsonAtomic } from './fs-json';
import { __fs } from '@tauri-apps/plugin-fs';

const PATH = 'C:/Users/test/AppData/Roaming/com.fknoobscoh.app/settings.json';

describe('fs-json', () => {
	beforeEach(() => {
		__fs.reset();
	});

	it('writes atomically and leaves no tmp file behind', async () => {
		await writeJsonAtomic(PATH, { a: 1 });

		expect(__fs.has(PATH)).toBe(true);
		expect(__fs.has(`${PATH}.tmp`)).toBe(false);
		expect(JSON.parse(__fs.getFileText(PATH)!)).toEqual({ a: 1 });
	});

	it('overwrites existing files', async () => {
		await writeJsonAtomic(PATH, { a: 1 });
		await writeJsonAtomic(PATH, { a: 2 });

		expect(JSON.parse(__fs.getFileText(PATH)!)).toEqual({ a: 2 });
	});

	it('reads back what was written', async () => {
		await writeJsonAtomic(PATH, { nested: { value: true } });

		const result = await readJsonWithRecovery(PATH);

		expect(result).toEqual({ ok: true, data: { nested: { value: true } }, recoveredFromTmp: false });
	});

	it('recovers from the tmp file when the destination is missing (crash mid-swap)', async () => {
		// Simulates a crash after `remove(dest)` but before `rename(tmp, dest)`.
		__fs.setFile(`${PATH}.tmp`, JSON.stringify({ recovered: true }));

		const result = await readJsonWithRecovery(PATH);

		expect(result).toEqual({ ok: true, data: { recovered: true }, recoveredFromTmp: true });
	});

	it('recovers from the tmp file when the destination is corrupt', async () => {
		__fs.setFile(PATH, '{ not json');
		__fs.setFile(`${PATH}.tmp`, JSON.stringify({ recovered: true }));

		const result = await readJsonWithRecovery(PATH);

		expect(result).toEqual({ ok: true, data: { recovered: true }, recoveredFromTmp: true });
	});

	it('reports missing files', async () => {
		const result = await readJsonWithRecovery(PATH);

		expect(result).toEqual({ ok: false, error: 'missing' });
	});

	it('reports corrupt files without recovery option', async () => {
		__fs.setFile(PATH, 'garbage');

		const result = await readJsonWithRecovery(PATH);

		expect(result).toEqual({ ok: false, error: 'invalid' });
	});
});
