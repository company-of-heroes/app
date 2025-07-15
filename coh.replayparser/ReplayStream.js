import fs from 'fs';
import crypto from 'crypto';

export default class ReplayStream {
	constructor(filePathOrBuffer) {
		if (typeof filePathOrBuffer === 'string') {
			// File path
			this.buffer = fs.readFileSync(filePathOrBuffer);
			this.fileName = filePathOrBuffer;
		} else {
			// Buffer
			this.buffer = filePathOrBuffer;
			this.fileName = 'buffer';
		}

		this.position = 0;
		this.length = this.buffer.length;
		this.MD5hash = this.getMD5hash();

		console.log(`ReplayStream created: ${this.fileName} (${this.length} bytes)`);
		this.seek(0);
	}

	close() {
		// JavaScript doesn't need explicit file closing for buffers
		this.buffer = null;
	}

	readUInt16() {
		this.checkBounds(2);
		const value = this.buffer.readUInt16LE(this.position);
		this.position += 2;
		return value;
	}

	readUInt32() {
		this.checkBounds(4);
		const value = this.buffer.readUInt32LE(this.position);
		this.position += 4;
		return value;
	}

	readASCIIStr(length) {
		if (typeof length === 'undefined') {
			length = this.readUInt32();
		}

		this.checkBounds(length);
		const str = this.buffer.toString('ascii', this.position, this.position + length);
		this.position += length;
		return str.replace(/\0/g, ''); // Remove null terminators
	}

	readUnicodeStr(length) {
		if (typeof length === 'undefined') {
			length = this.readUInt32();
		}

		const byteLength = length * 2;
		this.checkBounds(byteLength);
		const str = this.buffer.toString('utf16le', this.position, this.position + byteLength);
		this.position += byteLength;
		return str.replace(/\0/g, ''); // Remove null terminators
	}

	readBytes(count) {
		this.checkBounds(count);
		const data = this.buffer.subarray(this.position, this.position + count);
		this.position += count;
		return data;
	}

	skip(offset) {
		this.position += offset;
		this.checkPosition();
	}

	seek(position) {
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

	checkBounds(bytesNeeded) {
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

	getMD5hash() {
		const hash = crypto.createHash('md5');
		hash.update(this.buffer);
		return hash.digest('hex').toUpperCase();
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
