const fs = require('fs');

class ReplayParser {
	/**
	 * Parses a Company of Heroes 1 replay header.
	 * @param {string} [filePath=null] - Path to the replay file.
	 * @param {object} [settings={}] - Optional settings object.
	 */
	constructor(filePath = null, settings = {}) {
		this.settings = settings; // Assuming settings might be used later
		this.filePath = filePath;

		this.fileVersion = null;
		this.chunkyVersion = null;
		this.randomStart = null;
		this.highResources = null;
		this.VPCount = null;
		this.matchType = null;
		this.localDateString = null;
		this.localDate = null;
		this.unknownDate = null;
		this.replayName = null;
		this.gameVersion = null;
		this.modName = null;
		this.mapName = null;
		this.mapNameFull = null; // UCS resolution removed for this example
		this.mapDescription = null;
		this.mapDescriptionFull = null; // UCS resolution removed for this example
		this.mapFileName = null;
		this.mapWidth = null;
		this.mapHeight = null;
		this.playerList = [];

		this.success = null;

		/** @type {Buffer|null} */
		this.data = null;
		this.dataIndex = 0;

		if (filePath) {
			this.load(this.filePath);
		}
	}

	/**
	 * Reads 4 bytes as an unsigned little-endian integer.
	 * @returns {number|undefined}
	 */
	readUnsignedLong4Bytes() {
		try {
			if (this.data && this.dataIndex + 4 <= this.data.length) {
				const value = this.data.readUInt32LE(this.dataIndex);
				this.dataIndex += 4;
				return value;
			}
			throw new Error('Not enough data to read 4 bytes or data is null.');
		} catch (e) {
			console.error('Failed to read 4 bytes:', e.message);
			this.success = false;
			return undefined;
		}
	}

	/**
	 * Reads a specified number of bytes from the data buffer.
	 * @param {number} numberOfBytes - The number of bytes to read.
	 * @returns {Buffer|undefined}
	 */
	readBytes(numberOfBytes) {
		try {
			if (this.data && this.dataIndex + numberOfBytes <= this.data.length) {
				const output = this.data.slice(this.dataIndex, this.dataIndex + numberOfBytes);
				this.dataIndex += numberOfBytes;
				return output;
			}
			throw new Error(`Not enough data to read ${numberOfBytes} bytes or data is null.`);
		} catch (e) {
			console.error('Failed to read bytes:', e.message);
			this.success = false;
			return undefined;
		}
	}

	/**
	 * Reads a length-prefixed UTF-16LE string.
	 * @returns {string|undefined}
	 */
	readLengthString() {
		try {
			const stringLength = this.readUnsignedLong4Bytes();
			if (stringLength === undefined) return undefined;
			return this.read2ByteString(stringLength);
		} catch (e) {
			console.error('Failed to read length-prefixed string:', e.message);
			this.success = false;
			return undefined;
		}
	}

	/**
	 * Reads a UTF-16LE string of a specified character length.
	 * @param {number} stringLength - The number of characters (not bytes).
	 * @returns {string|undefined}
	 */
	read2ByteString(stringLength = 0) {
		try {
			const numBytes = stringLength * 2;
			const theBytes = this.readBytes(numBytes);
			if (!theBytes) return undefined;
			return theBytes.toString('utf16le');
		} catch (e) {
			console.error('Failed to read UTF-16LE string:', e.message);
			this.success = false;
			return undefined;
		}
	}

	/**
	 * Reads a length-prefixed ASCII string.
	 * @returns {string|undefined}
	 */
	readLengthASCIIString() {
		try {
			const stringLength = this.readUnsignedLong4Bytes();
			if (stringLength === undefined) return undefined;
			return this.readASCIIString(stringLength);
		} catch (e) {
			console.error('Failed to read length-prefixed ASCII string:', e.message);
			this.success = false;
			return undefined;
		}
	}

	/**
	 * Reads an ASCII string of a specified length.
	 * @param {number} stringLength - The number of bytes/characters.
	 * @returns {string|undefined}
	 */
	readASCIIString(stringLength = 0) {
		try {
			const theBytes = this.readBytes(stringLength);
			if (!theBytes) return undefined;
			return theBytes.toString('ascii');
		} catch (e) {
			console.error('Failed to read ASCII string:', e.message);
			this.success = false;
			return undefined;
		}
	}

	/**
	 * Reads a null-terminated UTF-16LE string.
	 * @returns {string|undefined}
	 */
	readNullTerminated2ByteString() {
		try {
			if (!this.data) throw new Error('Data buffer is null.');

			let characters = '';
			while (this.dataIndex + 2 <= this.data.length) {
				const word = this.data.readUInt16LE(this.dataIndex);
				if (word === 0x0000) {
					this.dataIndex += 2; // Consume the null terminator
					return characters;
				}
				const charBytes = this.readBytes(2);
				if (!charBytes) break; // Should not happen if length check passed, but safety first
				characters += charBytes.toString('utf16le');
			}
			throw new Error('Reached end of buffer before finding null terminator.');
		} catch (e) {
			console.error('Failed to read null-terminated UTF-16LE string:', e.message);
			this.success = false;
			return undefined;
		}
	}

	/**
	 * Reads a null-terminated ASCII string.
	 * @returns {string|undefined}
	 */
	readNullTerminatedASCIIString() {
		try {
			if (!this.data) throw new Error('Data buffer is null.');

			let characters = '';
			while (this.dataIndex < this.data.length) {
				const byte = this.data.readUInt8(this.dataIndex);
				if (byte === 0x00) {
					this.dataIndex += 1; // Consume the null terminator
					return characters;
				}
				const charByte = this.readBytes(1);
				if (!charByte) break; // Safety check
				characters += charByte.toString('ascii');
			}
			throw new Error('Reached end of buffer before finding null terminator.');
		} catch (e) {
			console.error('Failed to read null-terminated ASCII string:', e.message);
			this.success = false;
			return undefined;
		}
	}

	/**
	 * Moves the data index.
	 * @param {number} numberOfBytes - The number of bytes to move.
	 * @param {0|1|2} [relative=0] - 0: absolute, 1: relative to current, 2: relative to end.
	 */
	seek(numberOfBytes, relative = 0) {
		try {
			if (!this.data) throw new Error('Data buffer is null.');
			const length = this.data.length;
			let newIndex;

			if (relative === 0) {
				// Absolute
				newIndex = numberOfBytes;
			} else if (relative === 1) {
				// Relative to current
				newIndex = this.dataIndex + numberOfBytes;
			} else if (relative === 2) {
				// Relative to end
				newIndex = length - numberOfBytes;
			} else {
				throw new Error('Invalid relative value. Use 0, 1, or 2.');
			}

			if (newIndex < 0 || newIndex > length) {
				throw new Error(`Seek position ${newIndex} is out of bounds (0-${length}).`);
			}
			this.dataIndex = newIndex;
		} catch (e) {
			console.error('Failed to seek:', e.message);
			this.success = false; // Indicate potential issue, though seek itself might not warrant full failure
		}
	}

	/**
	 * Loads replay data from a file path.
	 * @param {string} filePath - The path to the replay file.
	 */
	load(filePath) {
		try {
			this.data = fs.readFileSync(filePath);
			this.filePath = filePath;
			this.dataIndex = 0;
			this.process_data();
		} catch (e) {
			console.error(`Failed to load or process file "${filePath}":`, e.message);
			this.success = false;
			this.data = null;
		}
	}

	/**
	 * Processes the loaded replay data.
	 * @returns {boolean} - True if processing was successful (so far), false otherwise.
	 */
	process_data() {
		if (!this.data) {
			console.error('No data loaded to process.');
			return false;
		}
		this.success = true; // Assume success until an error occurs

		try {
			// Process the file Header
			this.fileVersion = this.readUnsignedLong4Bytes(); // int (8)
			if (!this.success) return false;

			this.readASCIIString(8); // COH__REC
			if (!this.success) return false;

			this.localDateString = this.readNullTerminated2ByteString();
			if (!this.success) return false;

			// Parse localDateString as a Date object
			this.localDate = this.decodeDate(this.localDateString);
			// decodeDate doesn't set this.success, check if date is valid
			if (!this.localDate) {
				// Logged within decodeDate if parsing fails
				// Decide if this is a fatal error - currently not treated as fatal
			}

			// --- Start: Refined Relic Chunky Seek Logic ---
			this.seek(76, 0);
			if (!this.success) return false; // Check seek success

			const firstRelicChunkyAddress = this.dataIndex; // Should be 76

			this.readASCIIString(12); // relicChunky
			if (!this.success) return false;
			this.readUnsignedLong4Bytes(); // unknown
			if (!this.success) return false;
			this.chunkyVersion = this.readUnsignedLong4Bytes(); // 3
			if (!this.success) return false;
			this.readUnsignedLong4Bytes(); // unknown
			if (!this.success) return false;
			const chunkyHeaderLength = this.readUnsignedLong4Bytes(); // Read length of first header block
			if (!this.success || chunkyHeaderLength === undefined) return false;

			// Explicitly follow Python seek logic to find second header start
			this.seek(firstRelicChunkyAddress, 0); // Go back to start of first header address (76)
			if (!this.success) return false;
			this.seek(96, 1); // Move forward 96 bytes from there (76 + 96 = 172)
			if (!this.success) return false;

			const secondRelicChunkyAddress = this.dataIndex; // Should be 172

			this.readASCIIString(12); // relicChunky
			if (!this.success) return false;
			this.readUnsignedLong4Bytes(); // unknown
			if (!this.success) return false;
			this.readUnsignedLong4Bytes(); // chunkyVersion 3
			if (!this.success) return false;
			this.readUnsignedLong4Bytes(); // unknown
			if (!this.success) return false;
			const secondChunkLength = this.readUnsignedLong4Bytes(); // Read length of second header block
			if (!this.success || secondChunkLength === undefined) return false;

			// Seek to the start of the actual data chunks
			this.seek(secondRelicChunkyAddress, 0); // Go back to start of second header address (172)
			if (!this.success) return false;
			this.seek(secondChunkLength, 1); // Move forward by the length of the second header block
			if (!this.success) return false;
			// --- End: Refined Relic Chunky Seek Logic ---

			// Parse the main data chunks
			this.parse_chunk(0);
			if (!this.success) return false;
			this.parse_chunk(0); // Often two top-level FOLD chunks
			if (!this.success) return false;
		} catch (e) {
			console.error('Error during process_data:', e.message);
			this.success = false;
		}

		return this.success;
	}

	/**
	 * Parses a data chunk recursively.
	 * @param {number} level - Recursion depth (for debugging/indentation).
	 */
	parse_chunk(level) {
		if (!this.success) return; // Stop recursion if an error occurred

		try {
			const chunkStartOuter = this.dataIndex; // Position before reading chunk header

			const chunkType = this.readASCIIString(8);
			if (!this.success || !chunkType) return;

			const chunkVersion = this.readUnsignedLong4Bytes();
			if (!this.success || chunkVersion === undefined) return;

			const chunkLength = this.readUnsignedLong4Bytes();
			if (!this.success || chunkLength === undefined) return;

			const chunkNameLength = this.readUnsignedLong4Bytes();
			if (!this.success || chunkNameLength === undefined) return;

			this.seek(8, 1); // Skip 8 unknown bytes
			if (!this.success) return;

			let chunkName = null;
			if (chunkNameLength > 0) {
				chunkName = this.readASCIIString(chunkNameLength);
				if (!this.success) return;
			}

			const chunkStartInner = this.dataIndex; // Position after reading chunk header, start of data/subchunks
			const chunkEnd = chunkStartInner + chunkLength; // Expected end position of this chunk's data

			// Recursive descent for FOLD chunks
			if (chunkType.startsWith('FOLD')) {
				while (this.dataIndex < chunkEnd) {
					// Check for potential infinite loop / malformed data
					const posBeforeSubChunk = this.dataIndex;
					this.parse_chunk(level + 1);
					if (!this.success) return; // Propagate error up
					// If dataIndex didn't advance, break to prevent infinite loop
					if (this.dataIndex <= posBeforeSubChunk) {
						console.error(
							`Chunk parsing stuck at index ${this.dataIndex} within FOLD chunk starting at ${chunkStartOuter}. Breaking loop.`
						);
						this.success = false; // Indicate error state
						return;
					}
				}
			}
			// Data chunk parsing
			else if (chunkType === 'DATASDSC' && chunkVersion === 2004) {
				this.readUnsignedLong4Bytes(); // unknown
				this.unknownDate = this.readLengthString();
				this.readUnsignedLong4Bytes(); // unknown
				this.readUnsignedLong4Bytes(); // unknown
				this.readUnsignedLong4Bytes(); // unknown
				this.modName = this.readLengthASCIIString();
				this.mapFileName = this.readLengthASCIIString();
				this.readUnsignedLong4Bytes(); // unknown
				this.readUnsignedLong4Bytes(); // unknown
				this.readUnsignedLong4Bytes(); // unknown
				this.readUnsignedLong4Bytes(); // unknown
				this.readUnsignedLong4Bytes(); // unknown
				this.mapName = this.readLengthString();

				const value = this.readUnsignedLong4Bytes();
				if (value !== undefined && value !== 0) {
					// test to see if data is replicated or not
					this.read2ByteString(value); // unknown string
				}
				this.mapDescription = this.readLengthString();
				this.readUnsignedLong4Bytes(); // unknown
				this.mapWidth = this.readUnsignedLong4Bytes();
				this.mapHeight = this.readUnsignedLong4Bytes();
				this.readUnsignedLong4Bytes(); // unknown
				this.readUnsignedLong4Bytes(); // unknown
				this.readUnsignedLong4Bytes(); // unknown
			} else if (chunkType === 'DATABASE' && chunkVersion === 11) {
				this.seek(16, 1);

				const randomStartVal = this.readUnsignedLong4Bytes();
				this.randomStart = randomStartVal !== undefined && randomStartVal !== 1; // 1 is fixed, 0 is random
				console.log(`Random Start: ${randomStartVal}`);

				this.readUnsignedLong4Bytes(); // COLS

				const highResVal = this.readUnsignedLong4Bytes();
				this.highResources = highResVal === 1;

				this.readUnsignedLong4Bytes(); // TSSR

				const vpVal = this.readUnsignedLong4Bytes();
				if (vpVal !== undefined) {
					this.VPCount = 250 * (1 << vpVal);
				}

				this.seek(5, 1);

				this.replayName = this.readLengthString();

				this.seek(8, 1);

				const vpGameVal = this.readUnsignedLong4Bytes();
				this.VPGame = vpGameVal === 0x603872a3;

				this.seek(23, 1);

				this.readLengthASCIIString(); // gameminorversion

				this.seek(4, 1);

				this.readLengthASCIIString(); // gamemajorversion

				this.seek(8, 1);

				// matchname / gameversion section
				const versionIndicator = this.readUnsignedLong4Bytes();
				if (versionIndicator === 2) {
					this.readLengthASCIIString(); // gameversion string label?
					this.gameVersion = this.readLengthASCIIString(); // actual game version
				} else {
					// If indicator is not 2, maybe seek back or handle differently?
					// The python code reads the next string regardless. Let's stick to that for now.
					// this.seek(-4, 1); // Optional: rewind if indicator wasn't 2
				}

				this.readLengthASCIIString(); // Often empty or placeholder

				this.matchType = this.readLengthASCIIString();
				// Handle specific Korean automatch string if necessary
				// The specific Korean string literal needs careful handling in JS
				// Using includes might be sufficient if the core part is ASCII representable
				// or use unicode escape sequences if needed.
				if (
					this.matchType &&
					this.matchType.includes('\uc0de\u0bad\u0101\u4204\u4cc5\u0103\u1000')
				) {
					// Example check
					this.matchType = 'automatch';
				}
			} else if (chunkType === 'DATAINFO' && chunkVersion === 6) {
				const userName = this.readLengthString();
				this.readUnsignedLong4Bytes();
				this.readUnsignedLong4Bytes();
				const faction = this.readLengthASCIIString();
				this.readUnsignedLong4Bytes();
				this.readUnsignedLong4Bytes();

				if (this.success) {
					// Only add if reads were successful
					this.playerList.push({ name: userName, faction: faction });
				}
			}

			// Ensure we are at the end of the chunk's data after processing
			// This helps catch errors where not all data within a chunk was consumed
			if (this.success && this.dataIndex < chunkEnd) {
				// console.warn(`Chunk ${chunkType} v${chunkVersion} (len ${chunkLength}) ended at ${this.dataIndex}, expected ${chunkEnd}. Skipping remaining ${chunkEnd - this.dataIndex} bytes.`);
				this.seek(chunkEnd, 0); // Skip to the expected end
			} else if (this.success && this.dataIndex > chunkEnd) {
				console.error(
					`Chunk ${chunkType} v${chunkVersion} (len ${chunkLength}) read past expected end ${chunkEnd} to ${this.dataIndex}. Data corruption likely.`
				);
				this.success = false; // Mark as failure due to over-read
				return;
			}
			// If !this.success, an error already occurred, no need to seek.
		} catch (e) {
			console.error(`Error parsing chunk at level ${level}, index ${this.dataIndex}:`, e.message);
			this.success = false;
		}
	}

	/**
	 * Decodes the date string into a JavaScript Date object.
	 * @param {string|null|undefined} timeString - The date string from the replay.
	 * @returns {Date|null} - The parsed Date object or null if parsing fails.
	 */
	decodeDate(timeString) {
		if (!timeString) return null;

		try {
			// 24hr: DD.MM.YYYY HH.mm (Note: Changed separator from - to . based on common format)
			const reEuro = /(\d{2})\.(\d{2})\.(\d{4})\s(\d{2})\.(\d{2})/;
			let match = timeString.match(reEuro);
			if (match) {
				// console.log("Euro String Match:", match);
				const [, day, month, year, hour, minute] = match.map(Number);
				// Month is 0-indexed in JS Date constructor
				return new Date(Date.UTC(year, month - 1, day, hour, minute));
			}

			// 12hr: MM/DD/YYYY hh.mm XM (Note: Changed time separator from : to .)
			const reUS = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s(\d{1,2})\.(\d{2}).*?([AP])M/i;
			match = timeString.match(reUS);
			if (match) {
				// console.log("US String Match:", match);
				let [, month, day, year, hour, minute, meridiem] = match;
				[month, day, year, hour, minute] = [month, day, year, hour, minute].map(Number);
				meridiem = meridiem.toUpperCase();

				if (hour === 12 && meridiem === 'A') hour = 0; // 12 AM is 00 hours
				if (hour !== 12 && meridiem === 'P') hour += 12; // PM hours (except 12 PM)

				return new Date(Date.UTC(year, month - 1, day, hour, minute));
			}

			// YYYY/MM/DD HH.MM (Asian format, note time separator .)
			const reAsian = /(\d{4})\/(\d{2})\/(\d{2})\s([^\s]+)\s(\d{1,2})\.(\d{2})/;
			match = timeString.match(reAsian);
			if (match) {
				// console.log("Asian String Match:", match);
				let [, year, month, day, meridiemStr, hour, minute] = match;
				[year, month, day, hour, minute] = [year, month, day, hour, minute].map(Number);

				if (meridiemStr === '오후' && hour !== 12) {
					// Korean PM
					hour += 12;
				} else if (meridiemStr === '오전' && hour === 12) {
					// Korean AM (12 AM -> 00)
					hour = 0;
				}
				// Add checks for other AM/PM markers if necessary

				return new Date(Date.UTC(year, month - 1, day, hour, minute));
			}

			console.warn('Could not parse date string with known formats:', timeString); // More specific warning
			return null; // Return null if no format matches
		} catch (e) {
			console.error('Error decoding date:', e.message);
			return null;
		}
	}

	/**
	 * Returns a string representation of the parsed data.
	 * @returns {string}
	 */
	toString() {
		let output = 'Data:\n';
		output += `success : ${this.success}\n`;
		output += `fileVersion : ${this.fileVersion}\n`;
		output += `chunkyVersion : ${this.chunkyVersion}\n`;
		output += `randomStart : ${this.randomStart}\n`;
		output += `highResources : ${this.highResources}\n`;
		output += `VPCount : ${this.VPCount}\n`;
		output += `matchType : ${this.matchType}\n`;
		output += `localDateString : ${this.localDateString}\n`;
		output += `localDate : ${this.localDate ? this.localDate.toISOString() : 'null'}\n`;
		output += `unknownDate : ${this.unknownDate}\n`;
		output += `replayName : ${this.replayName}\n`;
		output += `gameVersion : ${this.gameVersion}\n`;
		output += `modName : ${this.modName}\n`;
		output += `mapName : ${this.mapName}\n`;
		// output += `mapNameFull : ${this.mapNameFull}\n`; // UCS related
		output += `mapDescription : ${this.mapDescription}\n`;
		// output += `mapDescriptionFull : ${this.mapDescriptionFull}\n`; // UCS related
		output += `mapFileName : ${this.mapFileName}\n`;
		output += `mapWidth : ${this.mapWidth}\n`;
		output += `mapHeight : ${this.mapHeight}\n`;
		output += `playerList Size : ${this.playerList.length}\n`;
		output += `playerList : ${JSON.stringify(this.playerList, null, 2)}\n`;
		return output;
	}
}

export { ReplayParser };

const testReplayPath =
	'/home/codeit/fknoobscoh/node-test/6p_red_ball_express.2022-08-16.22-03-51.rec'; // Replace with a valid path
if (fs.existsSync(testReplayPath)) {
	console.log(`Parsing replay: ${testReplayPath}`);
	const parser = new ReplayParser(testReplayPath);
	if (parser.success) {
		console.log('Parsing successful.');
		console.log(parser.toString());
	} else {
		console.error('Parsing failed.');
		console.log(parser.toString()); // Log partial data even on failure
	}
} else {
	console.warn(`Test replay file not found: ${testReplayPath}`);
}
