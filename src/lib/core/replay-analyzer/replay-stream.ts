import { readFile } from '@tauri-apps/plugin-fs';

export default class ReplayStream {
	uint8array: Uint8Array | null;
	dataView: DataView | null;
	fileName: string;
	position: number;
	length: number;

	private constructor(fileContent: Uint8Array) {
		this.uint8array = fileContent;
		this.dataView = new DataView(
			this.uint8array.buffer,
			this.uint8array.byteOffset,
			this.uint8array.byteLength
		);
		this.fileName = 'buffer';
		this.position = 0;
		this.length = this.uint8array.length;

		console.log(`ReplayStream created: ${this.fileName} (${this.length} bytes)`);
		this.seek(0);
	}

	static async load(path: string): Promise<ReplayStream> {
		const file = await readFile(path);
		return new ReplayStream(file);
	}

	close() {
		// JavaScript doesn't need explicit file closing for buffers
		this.uint8array = null;
		this.dataView = null;
	}

	readUInt16() {
		this.checkBounds(2);
		const value = this.dataView!.getUint16(this.position, true); // true for little-endian
		this.position += 2;
		return value;
	}

	readUInt32() {
		this.checkBounds(4);
		const value = this.dataView!.getUint32(this.position, true); // true for little-endian
		this.position += 4;
		return value;
	}

	readASCIIStr(length?: number) {
		if (typeof length === 'undefined') {
			length = this.readUInt32();
		}

		this.checkBounds(length);
		const bytes = this.uint8array!.subarray(this.position, this.position + length);
		const str = new TextDecoder('ascii').decode(bytes);
		this.position += length;
		return str.replace(/\0/g, ''); // Remove null terminators
	}

	readUnicodeStr(length?: number) {
		if (typeof length === 'undefined') {
			length = this.readUInt32();
		}

		const byteLength = length * 2;
		this.checkBounds(byteLength);
		const bytes = this.uint8array!.subarray(this.position, this.position + byteLength);
		const str = new TextDecoder('utf-16le').decode(bytes);
		this.position += byteLength;
		return str.replace(/\0/g, ''); // Remove null terminators
	}

	readBytes(count: number): Uint8Array {
		this.checkBounds(count);
		const data = this.uint8array!.subarray(this.position, this.position + count);
		this.position += count;
		return data;
	}

	skip(offset: number) {
		this.position += offset;
		this.checkPosition();
	}

	seek(position: number) {
		this.position = position;
		this.checkPosition();
	}

	peek(offset = 0) {
		const savedPosition = this.position;
		this.seek(this.position + offset);
		this.checkBounds(4);
		const value = this.readUInt32();
		this.seek(savedPosition);
		return value;
	}

	checkBounds(bytesNeeded: number) {
		if (this.position + bytesNeeded > this.length) {
			throw new Error(
				`ReplayStream: Attempt to read ${bytesNeeded} bytes at position ${this.position}, but only ${this.length - this.position} bytes available`
			);
		}
	}

	checkPosition() {
		if (this.position < 0) {
			this.position = 0;
		} else if (this.position > this.length) {
			this.position = this.length;
		}
	}

	// Helper method to check if we're near end of file
	isNearEnd(threshold = 100) {
		return this.length - this.position < threshold;
	}

	// Helper method to get remaining bytes
	remainingBytes() {
		return this.length - this.position;
	}
}
