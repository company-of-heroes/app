/**
 * In-memory test double for @tauri-apps/plugin-fs.
 *
 * Supports the subset of the API used by the app core:
 * exists, readTextFile, writeTextFile, readFile, writeFile, rename, remove,
 * mkdir, readDir, stat, copyFile and open() with seek/read/close.
 */

export enum SeekMode {
	Start = 0,
	Current = 1,
	End = 2
}

type Node = { type: 'file'; data: Uint8Array } | { type: 'dir' };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let files = new Map<string, Node>();

export function normalize(path: string): string {
	return path.replace(/\\/g, '/').replace(/\/+$/, '').replace(/\/+/g, '/');
}

function parent(path: string): string {
	const idx = normalize(path).lastIndexOf('/');
	return idx <= 0 ? '' : normalize(path).slice(0, idx);
}

/** Test helpers (not part of the real plugin API) */
export const __fs = {
	reset() {
		files = new Map();
	},
	setFile(path: string, content: string | Uint8Array) {
		const data = typeof content === 'string' ? encoder.encode(content) : content;
		ensureDirs(parent(path));
		files.set(normalize(path), { type: 'file', data });
	},
	setDir(path: string) {
		ensureDirs(normalize(path));
	},
	getFileText(path: string): string | undefined {
		const node = files.get(normalize(path));
		return node?.type === 'file' ? decoder.decode(node.data) : undefined;
	},
	has(path: string): boolean {
		return files.has(normalize(path));
	},
	listFiles(): string[] {
		return [...files.entries()].filter(([, n]) => n.type === 'file').map(([p]) => p);
	},
	/** Append text to an existing file (log tail simulation) */
	append(path: string, content: string) {
		const key = normalize(path);
		const node = files.get(key);
		const prev = node?.type === 'file' ? node.data : new Uint8Array(0);
		const next = new Uint8Array(prev.length + encoder.encode(content).length);
		next.set(prev, 0);
		next.set(encoder.encode(content), prev.length);
		files.set(key, { type: 'file', data: next });
	}
};

function ensureDirs(path: string) {
	if (!path) return;
	const segments = normalize(path).split('/');
	let current = '';
	for (const segment of segments) {
		current = current ? `${current}/${segment}` : segment;
		if (!files.has(current)) {
			files.set(current, { type: 'dir' });
		}
	}
}

export async function exists(path: string): Promise<boolean> {
	if (!path) return false;
	return files.has(normalize(path));
}

export async function readTextFile(path: string): Promise<string> {
	const node = files.get(normalize(path));
	if (!node || node.type !== 'file') {
		throw new Error(`No such file: ${path}`);
	}
	return decoder.decode(node.data);
}

export async function readFile(path: string): Promise<Uint8Array> {
	const node = files.get(normalize(path));
	if (!node || node.type !== 'file') {
		throw new Error(`No such file: ${path}`);
	}
	return node.data;
}

export async function writeTextFile(path: string, content: string): Promise<void> {
	ensureDirs(parent(path));
	files.set(normalize(path), { type: 'file', data: encoder.encode(content) });
}

export async function writeFile(path: string, content: Uint8Array): Promise<void> {
	ensureDirs(parent(path));
	files.set(normalize(path), { type: 'file', data: content });
}

export async function rename(from: string, to: string): Promise<void> {
	const node = files.get(normalize(from));
	if (!node) {
		throw new Error(`No such file: ${from}`);
	}
	// Mirror Windows std::fs::rename semantics: fail when destination exists.
	if (files.has(normalize(to))) {
		throw new Error(`Destination exists: ${to}`);
	}
	files.delete(normalize(from));
	ensureDirs(parent(to));
	files.set(normalize(to), node);
}

export async function remove(path: string): Promise<void> {
	if (!files.delete(normalize(path))) {
		throw new Error(`No such file: ${path}`);
	}
}

export async function copyFile(from: string, to: string): Promise<void> {
	const node = files.get(normalize(from));
	if (!node || node.type !== 'file') {
		throw new Error(`No such file: ${from}`);
	}
	ensureDirs(parent(to));
	files.set(normalize(to), { type: 'file', data: node.data.slice() });
}

export async function mkdir(path: string, _options?: { recursive?: boolean }): Promise<void> {
	ensureDirs(normalize(path));
}

export type DirEntry = { name: string; isDirectory: boolean; isFile: boolean; isSymlink: boolean };

export async function readDir(path: string): Promise<DirEntry[]> {
	const dir = normalize(path);
	if (!files.has(dir)) {
		throw new Error(`No such directory: ${path}`);
	}
	const entries: DirEntry[] = [];
	for (const [key, node] of files) {
		if (key === dir) continue;
		if (parent(key) !== dir) continue;
		entries.push({
			name: key.slice(dir.length + 1),
			isDirectory: node.type === 'dir',
			isFile: node.type === 'file',
			isSymlink: false
		});
	}
	return entries;
}

export type FileInfo = {
	isFile: boolean;
	isDirectory: boolean;
	size: number;
	mtime: Date | null;
	birthtime: Date | null;
};

export async function stat(path: string): Promise<FileInfo> {
	const node = files.get(normalize(path));
	if (!node) {
		throw new Error(`No such file: ${path}`);
	}
	return {
		isFile: node.type === 'file',
		isDirectory: node.type === 'dir',
		size: node.type === 'file' ? node.data.length : 0,
		mtime: new Date(),
		birthtime: new Date()
	};
}

export class FileHandle {
	#path: string;
	#position = 0;

	constructor(path: string) {
		this.#path = normalize(path);
	}

	#data(): Uint8Array {
		const node = files.get(this.#path);
		if (!node || node.type !== 'file') {
			throw new Error(`No such file: ${this.#path}`);
		}
		return node.data;
	}

	async seek(offset: number, whence: SeekMode = SeekMode.Start): Promise<number> {
		const size = this.#data().length;
		if (whence === SeekMode.Start) this.#position = offset;
		else if (whence === SeekMode.Current) this.#position += offset;
		else this.#position = size + offset;
		return this.#position;
	}

	async read(buffer: Uint8Array): Promise<number | null> {
		const data = this.#data();
		if (this.#position >= data.length) {
			return null;
		}
		const slice = data.subarray(this.#position, this.#position + buffer.length);
		buffer.set(slice, 0);
		this.#position += slice.length;
		return slice.length;
	}

	async close(): Promise<void> {
		// no-op
	}
}

export async function open(
	path: string,
	_options?: { read?: boolean; write?: boolean }
): Promise<FileHandle> {
	if (!files.has(normalize(path))) {
		throw new Error(`No such file: ${path}`);
	}
	return new FileHandle(path);
}
