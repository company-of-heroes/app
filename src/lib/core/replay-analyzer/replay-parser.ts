import type { ActionDefinitions } from './action-definitions';
import { Replay, Tick } from './replay';

export default class ReplayParser {
	replay: Replay;

	private constructor(replay: Replay) {
		this.replay = replay;
	}

	static async parse(fileName: string, headerOnly = false, actionDefinitions?: ActionDefinitions) {
		const replay = await Replay.load(fileName, actionDefinitions);
		const replayParser = new ReplayParser(replay);

		return replayParser.parseReplay(replay, headerOnly);
	}

	private parseReplay(replay: Replay, headerOnly = false) {
		this.replay = replay;

		if (!replay.headerParsed) {
			this.parseHeader();
		}

		if (!headerOnly) {
			this.parseData();
		}

		this.replay!.replayStream!.close();
		return replay;
	}

	private parseHeader() {
		this.replay!.replayVersion = this.replay!.replayStream!.readUInt32();
		this.replay!.gameType = this.replay!.replayStream!.readASCIIStr(8);

		// Game date
		let L = 0;
		while (this.replay!.replayStream!.readUInt16() !== 0) ++L;
		this.replay!.replayStream!.seek(12);
		this.replay!.gameDate = this.decodeDate(this.replay!.replayStream!.readUnicodeStr(L));

		this.replay!.replayStream!.seek(76);

		this.parseChunky();
		this.parseChunky();

		this.replay!.headerParsed = true;
	}

	private parseData() {
		let tickIndex = 1;
		let tick;
		while (this.replay!.replayStream!.position < this.replay!.replayStream!.length) {
			if (this.replay!.replayStream!.readUInt32() === 1) {
				this.parseMessage(tickIndex);
			} else {
				tick = new Tick(
					this.replay!.replayStream!.readBytes(this.replay!.replayStream!.readUInt32())
				);
				this.parseTick(tick);
				tickIndex = tick.index;
			}
		}
		this.findPlayerIDs();
		this.findDoctrines();
	}

	private parseMessage(tick: number) {
		try {
			const pos = this.replay!.replayStream!.position;
			const length = this.replay!.replayStream!.readUInt32();

			if (this.replay!.replayStream!.readUInt32() > 0) {
				this.replay!.replayStream!.skip(4);

				let L;
				let playerName;
				let playerID;

				if ((L = this.replay!.replayStream!.readUInt32()) > 0) {
					playerName = this.replay!.replayStream!.readUnicodeStr(L);
					playerID = this.replay!.replayStream!.readUInt16();
				} else {
					playerName = 'System';
					playerID = 0;
					this.replay!.replayStream!.skip(2);
				}

				this.replay!.replayStream!.skip(6);

				const recipient = this.replay!.replayStream!.readUInt32();
				const message = this.replay!.replayStream!.readUnicodeStr(
					this.replay!.replayStream!.readUInt32()
				);
				this.replay!.addMessage(tick, playerName, playerID, message, recipient);
			}
			this.replay!.replayStream!.seek(pos + length + 4);
		} catch (e) {
			// Handle message exception
			console.error('Error parsing message:', e);
		}
	}

	private parseTick(tick: Tick) {
		let i = 12;
		for (let bundleCount = 0; bundleCount < tick.bundleCount; ++bundleCount) {
			if (i >= tick.data.length) {
				break; // Stop if we're at or past the end of the tick data
			}
			i += this.parseActions(tick, i);
		}
	}

	private parseActions(tick: Tick, index: number) {
		// Check if we can read the bundle length
		if (index + 13 > tick.data.length) {
			// 9 for offset + 4 for uint32
			return tick.data.length - index; // Consume rest of buffer to be safe
		}
		const bundleLength = tick.dataView.getUint32(index + 9, false); // false for big-endian

		let i = 14;
		// The loop should not go past the end of the bundle's data.
		while (index + i + 2 <= tick.data.length) {
			// +2 to ensure we can read the length (L)
			const L = tick.dataView.getInt16(index + i, true); // true for little-endian
			if (L <= 0) {
				break; // Prevent infinite loop on zero-length action
			}
			// Check if the action data is fully contained within the buffer
			if (index + i + L > tick.data.length) {
				break;
			}
			const data = tick.data.subarray(index + i, index + i + L);

			this.replay!.addAction(tick.tick, data);

			i += L;
		}

		return bundleLength + 13; // Return total size of the bundle structure
	}

	private parseChunk() {
		const chunkType = this.replay!.replayStream!.readASCIIStr(8);
		if (!(chunkType.substring(0, 4) === 'FOLD' || chunkType.substring(0, 4) === 'DATA')) {
			this.replay!.replayStream!.skip(-8);
			return false;
		}

		const chunkVersion = this.replay!.replayStream!.readUInt32();
		const chunkLength = this.replay!.replayStream!.readUInt32();
		const chunkNameLength = this.replay!.replayStream!.readUInt32();

		this.replay!.replayStream!.skip(8);

		let chunkName = '';
		if (chunkNameLength > 0) {
			chunkName = this.replay!.replayStream!.readASCIIStr(chunkNameLength);
		}

		const startPosition = this.replay!.replayStream!.position;

		if (chunkType.substring(0, 4) === 'FOLD') {
			while (this.replay!.replayStream!.position < startPosition + chunkLength) {
				this.parseChunk();
			}
		}

		if (chunkType === 'DATASDSC' && chunkVersion === 0x7d4) {
			this.replay!.replayStream!.skip(4);
			this.replay!.replayStream!.skip(12 + 2 * this.replay!.replayStream!.readUInt32());
			this.replay!.modName = this.replay!.replayStream!.readASCIIStr();
			this.replay!.mapFileName = this.replay!.replayStream!.readASCIIStr();
			this.replay!.replayStream!.skip(20);
			this.replay!.mapName = this.replay!.replayStream!.readUnicodeStr();
			this.replay!.replayStream!.skip(4);
			this.replay!.mapDescription = this.replay!.replayStream!.readUnicodeStr();
			this.replay!.replayStream!.skip(4);
			this.replay!.mapWidth = this.replay!.replayStream!.readUInt32();
			this.replay!.mapHeight = this.replay!.replayStream!.readUInt32();
		}

		if (chunkType === 'DATABASE' && chunkVersion === 0xb) {
			this.replay!.replayStream!.skip(8); // 02 00 00 00 02 00 00 00
			this.replay!.replayStream!.skip(8); // ?
			this.replay!.randomStart = this.replay!.replayStream!.readUInt32() === 0;
			this.replay!.replayStream!.skip(4); // COLS
			this.replay!.highResources = this.replay!.replayStream!.readUInt32() === 1;
			this.replay!.replayStream!.skip(4); // TSSR
			this.replay!.vpCount = 250 * (1 << this.replay!.replayStream!.readUInt32());
			this.replay!.replayStream!.skip(5); // KTPV 00
			this.replay!.replayName = this.replay!.replayStream!.readUnicodeStr();
			this.replay!.replayStream!.skip(8);
			this.replay!.VPgame = this.replay!.replayStream!.readUInt32() === 0x603872a3;
			this.replay!.replayStream!.skip(23);

			this.replay!.replayStream!.readASCIIStr(); // gameminorversion
			this.replay!.replayStream!.skip(4);
			this.replay!.replayStream!.readASCIIStr(); // gamemajorversion
			this.replay!.replayStream!.skip(8);
			if (this.replay!.replayStream!.readUInt32() === 2) {
				this.replay!.replayStream!.readASCIIStr(); // gameversion
				this.replay!.replayStream!.readASCIIStr(); // 199.117372 [04/27/11 09:18:18]
			}
			this.replay!.replayStream!.readASCIIStr(); // matchname
			this.replay!.matchType = this.replay!.replayStream!.readASCIIStr();
		}

		if (chunkType === 'DATAINFO' && chunkVersion === 6) {
			const player = this.replay!.replayStream!.readUnicodeStr();
			const id = this.replay!.replayStream!.readUInt16();
			this.replay!.replayStream!.skip(6);
			const faction = this.replay!.replayStream!.readASCIIStr();
			this.replay!.addPlayer(player, faction);
		}

		this.replay!.replayStream!.seek(startPosition + chunkLength);
		return true;
	}

	private parseChunky() {
		if (this.replay!.replayStream!.readASCIIStr(12) !== 'Relic Chunky') return false;

		this.replay!.replayStream!.skip(4);

		if (this.replay!.replayStream!.readUInt32() !== 3) return false;

		this.replay!.replayStream!.skip(4);
		this.replay!.replayStream!.skip(this.replay!.replayStream!.readUInt32() - 28);

		while (this.parseChunk());

		return true;
	}

	private decodeDate(s: string) {
		// 24hr: DD-MM-YYYY HH:mm
		const reEuro = /(\d\d).(\d\d).(\d\d\d\d)\s(\d\d).(\d\d)/;
		if (reEuro.test(s)) {
			const match = reEuro.exec(s);
			if (match) {
				return new Date(
					parseInt(match[3]), // year
					parseInt(match[2]) - 1, // month (0-based)
					parseInt(match[1]), // day
					parseInt(match[4]), // hour
					parseInt(match[5]), // minute
					0 // second
				);
			}
		}

		// 12hr: MM/DD/YYYY hh:mm XM *numbers are not 0-padded
		const reUS = /(\d{1,2}).(\d{1,2}).(\d\d\d\d)\s(\d{1,2}).(\d{1,2}).*?(\w)M/;
		if (reUS.test(s.toUpperCase())) {
			const match = reUS.exec(s);
			if (match) {
				let retval = new Date(
					parseInt(match[3]), // year
					parseInt(match[1]) - 1, // month (0-based)
					parseInt(match[2]), // day
					parseInt(match[4]), // hour
					parseInt(match[5]), // minute
					0 // second
				);

				if (match[6].toLowerCase() === 'p' && parseInt(match[4]) < 12) {
					retval.setHours(retval.getHours() + 12);
				}
				if (match[6].toLowerCase() === 'a' && parseInt(match[4]) === 12) {
					retval.setHours(retval.getHours() - 12);
					retval.setDate(retval.getDate() + 1);
				}
				return retval;
			}
		}

		// YYYY/MM/DD HH:MM
		const reAsian = /(\d\d\d\d).(\d\d).(\d\d)\s(\d\d).(\d\d)/;
		if (reAsian.test(s)) {
			const match = reAsian.exec(s);
			if (match) {
				return new Date(
					parseInt(match[1]), // year
					parseInt(match[2]) - 1, // month (0-based)
					parseInt(match[3]), // day
					parseInt(match[4]), // hour
					parseInt(match[5]), // minute
					0 // second
				);
			}
		}

		return new Date();
	}

	private findPlayerIDs() {
		for (const player of this.replay!.playerIterator()) {
			for (const message of this.replay!.messageIterator()) {
				if (message.playerName === player.name) {
					player.id = message.playerID;
					break;
				}
			}
		}
	}

	private findDoctrines() {
		for (const player of this.replay!.playerIterator()) {
			for (const action of this.replay!.actionIterator()) {
				if (action.actionType === 0x62) {
					if (player.doctrine === 0 && player.id === action.playerID) {
						player.doctrine = action.action;
						break;
					}
				}
			}
		}
	}
}
