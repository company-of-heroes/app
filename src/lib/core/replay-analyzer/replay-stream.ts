export class ReplayStream {
    private buffer: Uint8Array;
    private view: DataView;
    private _position: number = 0;
    private textDecoderUtf16 = new TextDecoder('utf-16le');

    constructor(buffer: Uint8Array) {
        this.buffer = buffer;
        this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }

    public get position(): number {
        return this._position;
    }

    public get length(): number {
        return this.buffer.length;
    }

    public seek(pos: number): void {
        this._position = pos;
    }

    public skip(count: number): void {
        this._position += count;
    }

    public readByte(): number {
        const val = this.view.getUint8(this._position);
        this._position += 1;
        return val;
    }

    public readBytes(length: number): Uint8Array {
        const buf = this.buffer.subarray(this._position, this._position + length);
        this._position += length;
        return buf;
    }

    public readUInt16(): number {
        const val = this.view.getUint16(this._position, true);
        this._position += 2;
        return val;
    }

    public readUInt32(): number {
        const val = this.view.getUint32(this._position, true);
        this._position += 4;
        return val;
    }

    public readInt32(): number {
        const val = this.view.getInt32(this._position, true);
        this._position += 4;
        return val;
    }

    public readFloat(): number {
        const val = this.view.getFloat32(this._position, true);
        this._position += 4;
        return val;
    }

    // Reads ASCII string with explicit length
    public readASCIIStr(length: number): string {
        // Manual ASCII decoding to match Node's 'ascii' behavior (7-bit) or just use ISO-8859-1
        // For game data, usually it's just simple chars.
        const bytes = this.buffer.subarray(this._position, this._position + length);
        let str = '';
        for (let i = 0; i < bytes.length; i++) {
            str += String.fromCharCode(bytes[i]);
        }
        this._position += length;
        // Remove null terminators if present
        return str.replace(/\0/g, '');
    }

    // Reads length-prefixed ASCII string (uint32 length + string)
    public readLengthPrefixedASCIIStr(): string {
        const length = this.readUInt32();
        return this.readASCIIStr(length);
    }

    // Reads Unicode (UTF-16LE) string with explicit length (in characters)
    public readUnicodeStr(length: number): string {
        const byteLength = length * 2;
        const bytes = this.buffer.subarray(this._position, this._position + byteLength);
        const str = this.textDecoderUtf16.decode(bytes);
        this._position += byteLength;
        return str;
    }

    // Reads length-prefixed Unicode string (uint32 length + string)
    public readLengthPrefixedUnicodeStr(): string {
        const length = this.readUInt32();
        return this.readUnicodeStr(length);
    }
}
