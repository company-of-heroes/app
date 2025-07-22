/**
 * Simplified Replay Parser for Company of Heroes replay files
 *
 * Takes a Uint8Array containing the replay file data and returns parsed replay information.
 * This is a much simpler, single-function approach compared to the complex class-based parser.
 */

export interface ParsedReplay {
	// Header information
	fileName: string;
	replayVersion: number;
	gameType: string;
	gameDate: Date;
	modName: string;
	mapFileName: string;
	mapName: string;
	mapNameFormatted: string;
	replayName: string;
	matchType: string;
	highResources: boolean;
	randomStart: boolean;
	vpCount: number;
	VPgame: boolean;
	duration: number;

	// Players
	players: Array<{
		name: string;
		faction: string;
		id: number;
		doctrine: number;
	}>;

	// Messages
	messages: Array<{
		tick: number;
		playerName: string;
		playerID: number;
		text: string;
		recipient: number;
		timeStamp: string;
	}>;

	// Actions (simplified)
	actions: Array<{
		tick: number;
		playerID: number;
		actionType: number;
		action: number;
		coordinates?: { x: number; y: number; z: number };
	}>;

	// Computed properties
	playerCount: number;
	messageCount: number;
	actionCount: number;
	teams: [
		Array<{ name: string; faction: string; id: number; doctrine: number }>,
		Array<{ name: string; faction: string; id: number; doctrine: number }>
	];
} /**
 * Simple binary data reader helper
 */
class BinaryReader {
	private view: DataView;
	private pos: number = 0;

	constructor(private data: Uint8Array) {
		this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	}

	get position() {
		return this.pos;
	}
	get length() {
		return this.data.length;
	}
	get remaining() {
		return this.length - this.pos;
	}

	seek(position: number) {
		this.pos = position;
	}
	skip(bytes: number) {
		this.pos += bytes;
	}

	readUInt8() {
		return this.data[this.pos++];
	}
	readUInt16() {
		const val = this.view.getUint16(this.pos, true);
		this.pos += 2;
		return val;
	}
	readUInt32() {
		const val = this.view.getUint32(this.pos, true);
		this.pos += 4;
		return val;
	}
	readFloat32() {
		const val = this.view.getFloat32(this.pos, true);
		this.pos += 4;
		return val;
	}

	readBytes(count: number) {
		const result = this.data.subarray(this.pos, this.pos + count);
		this.pos += count;
		return result;
	}

	readASCII(length?: number): string {
		if (length === undefined) {
			length = this.readUInt32();
			if (length > this.remaining || length > 65536) {
				throw new Error(`Invalid ASCII string length: ${length}`);
			}
		}
		const bytes = this.readBytes(length);
		return new TextDecoder('ascii').decode(bytes).replace(/\0/g, '');
	}

	readUTF16(charCount?: number): string {
		if (charCount === undefined) {
			charCount = this.readUInt32();
			if (charCount * 2 > this.remaining || charCount > 32768) {
				throw new Error(`Invalid UTF-16 string length: ${charCount}`);
			}
		}
		const bytes = this.readBytes(charCount * 2);
		return new TextDecoder('utf-16le').decode(bytes).replace(/\0/g, '');
	}
}

/**
 * Parse a Company of Heroes replay file
 * @param replayData - The raw replay file as Uint8Array
 * @param fileName - Optional filename for reference
 * @returns Parsed replay data
 */
export function parseReplay(
	replayData: Uint8Array,
	fileName: string = 'unknown.rec',
	headerOnly: boolean = false
): ParsedReplay {
	const reader = new BinaryReader(replayData);

	const result: ParsedReplay = {
		fileName,
		replayVersion: 0,
		gameType: '',
		gameDate: new Date(),
		modName: '',
		mapFileName: '',
		mapName: '',
		mapNameFormatted: '',
		replayName: '',
		matchType: '',
		highResources: false,
		randomStart: false,
		vpCount: 0,
		VPgame: false,
		duration: 0,
		players: [],
		messages: [],
		actions: [],
		playerCount: 0,
		messageCount: 0,
		actionCount: 0,
		teams: [[], []] // [axis, allies]
	};

	try {
		// Parse header
		parseHeader(reader, result);

		if (!headerOnly) {
			// Parse game data (ticks, messages, actions)
			parseGameData(reader, result);
		}

		// Set computed properties
		result.playerCount = result.players.length;
		result.messageCount = result.messages.length;
		result.actionCount = result.actions.length;

		// Calculate teams
		result.teams = calculateTeams(result.players);

		// Format map name
		result.mapNameFormatted = formatMapName(result.mapName);
	} catch (error) {
		console.error('Error parsing replay:', error);
		throw error;
	}

	return result;
}

function parseHeader(reader: BinaryReader, result: ParsedReplay) {
	// Read version and game type
	result.replayVersion = reader.readUInt32();
	result.gameType = reader.readASCII(8);

	// Parse game date
	let dateStrLength = 0;
	while (reader.readUInt16() !== 0) dateStrLength++;
	reader.seek(12);
	const dateStr = reader.readUTF16(dateStrLength);
	result.gameDate = parseGameDate(dateStr);

	reader.seek(76);

	// Parse chunky sections
	parseChunkySections(reader, result);
}

function parseChunkySections(reader: BinaryReader, result: ParsedReplay) {
	// Parse two chunky sections
	for (let i = 0; i < 2; i++) {
		if (!parseChunkySection(reader, result)) break;
	}
}

function parseChunkySection(reader: BinaryReader, result: ParsedReplay): boolean {
	if (reader.remaining < 12) return false;

	const header = reader.readASCII(12);
	if (header !== 'Relic Chunky') return false;

	reader.skip(4);
	if (reader.readUInt32() !== 3) return false;

	reader.skip(4);
	const skipBytes = reader.readUInt32() - 28;
	reader.skip(skipBytes);

	// Parse chunks
	while (parseChunk(reader, result)) {
		// Continue parsing chunks
	}

	return true;
}

function parseChunk(reader: BinaryReader, result: ParsedReplay): boolean {
	if (reader.remaining < 8) return false;

	const chunkType = reader.readASCII(8);
	if (!(chunkType.substring(0, 4) === 'FOLD' || chunkType.substring(0, 4) === 'DATA')) {
		reader.skip(-8);
		return false;
	}

	const version = reader.readUInt32();
	const length = reader.readUInt32();
	const nameLength = reader.readUInt32();

	reader.skip(8);

	let chunkName = '';
	if (nameLength > 0) {
		chunkName = reader.readASCII(nameLength);
	}

	const startPos = reader.position;

	// Handle specific chunk types
	if (chunkType === 'DATASDSC' && version === 0x7d4) {
		parseDataSDSC(reader, result);
	} else if (chunkType === 'DATABASE' && version === 0xb) {
		parseDatabase(reader, result);
	} else if (chunkType === 'DATAINFO' && version === 6) {
		parsePlayerInfo(reader, result);
	} else if (chunkType.substring(0, 4) === 'FOLD') {
		// Parse nested chunks
		while (reader.position < startPos + length) {
			if (!parseChunk(reader, result)) break;
		}
	}

	reader.seek(startPos + length);
	return true;
}

function parseDataSDSC(reader: BinaryReader, result: ParsedReplay) {
	reader.skip(4);
	const skipCount = reader.readUInt32();
	reader.skip(12 + 2 * skipCount);

	result.modName = reader.readASCII();
	result.mapFileName = reader.readASCII();
	reader.skip(20);
	result.mapName = result.mapFileName.split('\\').pop() || '';
}

function parseDatabase(reader: BinaryReader, result: ParsedReplay) {
	reader.skip(16); // Skip initial bytes
	result.randomStart = reader.readUInt32() === 0;
	reader.skip(4); // COLS
	result.highResources = reader.readUInt32() === 1;
	reader.skip(4); // TSSR
	result.vpCount = 250 * (1 << reader.readUInt32());
	reader.skip(5); // KTPV 00
	result.replayName = reader.readUTF16();
	reader.skip(8);
	result.VPgame = reader.readUInt32() === 0x603872a3;
	reader.skip(23);

	// Skip version strings
	reader.readASCII(); // gameminorversion
	reader.skip(4);
	reader.readASCII(); // gamemajorversion
	reader.skip(8);
	if (reader.readUInt32() === 2) {
		reader.readASCII(); // gameversion
		reader.readASCII(); // timestamp
	}
	reader.readASCII(); // matchname
	result.matchType = reader.readASCII();
}

function parsePlayerInfo(reader: BinaryReader, result: ParsedReplay) {
	const playerName = reader.readUTF16();
	const id = reader.readUInt16();
	reader.skip(6);
	const faction = reader.readASCII();

	result.players.push({
		name: playerName,
		faction,
		id,
		doctrine: 0
	});
}

function parseGameData(reader: BinaryReader, result: ParsedReplay) {
	let currentTick = 0;
	let firstTickTime = 0;
	let lastTickTime = 0;
	let tickCount = 0;

	while (reader.remaining > 4) {
		const marker = reader.readUInt32();

		if (marker === 1) {
			// Parse message
			parseMessage(reader, result, currentTick);
		} else {
			// When marker is not 1, we need to read another UInt32 for the tick data length
			const tickDataLength = reader.readUInt32();
			const tickData = reader.readBytes(tickDataLength);
			const tick = parseTick(tickData, result);

			if (tick) {
				currentTick = tick.tick;

				if (tickCount === 0) {
					firstTickTime = currentTick;
				}
				lastTickTime = currentTick;
				tickCount++;
			}
		}
	}

	// Calculate duration
	if (tickCount > 0) {
		result.duration = (lastTickTime - firstTickTime) / 8;
	}

	// Find player IDs and doctrines
	findPlayerDetails(result);
}

function parseMessage(reader: BinaryReader, result: ParsedReplay, tick: number) {
	const startPos = reader.position;
	const length = reader.readUInt32();

	if (reader.readUInt32() > 0) {
		reader.skip(4);

		let playerName: string;
		let playerID: number;

		const nameLength = reader.readUInt32();
		if (nameLength > 0) {
			playerName = reader.readUTF16(nameLength);
			playerID = reader.readUInt16();
		} else {
			playerName = 'System';
			playerID = 0;
			reader.skip(2);
		}

		reader.skip(6);
		const recipient = reader.readUInt32();
		const message = reader.readUTF16(reader.readUInt32());

		result.messages.push({
			tick,
			playerName,
			playerID,
			text: message,
			recipient,
			timeStamp: formatTime(tick)
		});
	}

	reader.seek(startPos + length + 4);
}

function parseTick(tickData: Uint8Array, result: ParsedReplay) {
	if (tickData.length < 16) return null;

	const tickReader = new BinaryReader(tickData);
	const tick = tickReader.readUInt32();
	const length = tickReader.readUInt32();
	const index = tickReader.readUInt32();
	const bundleCount = tickReader.readUInt32();

	// Parse actions in this tick
	let pos = 12;
	for (let i = 0; i < bundleCount && pos < tickData.length; i++) {
		pos += parseActionBundle(tickData, pos, tick, result);
	}

	return { tick, length, index, bundleCount };
}

function parseActionBundle(
	tickData: Uint8Array,
	startPos: number,
	tick: number,
	result: ParsedReplay
): number {
	// Check if we can read the bundle length
	if (startPos + 13 > tickData.length) {
		return tickData.length - startPos; // Consume rest of buffer to be safe
	}

	// Read bundle length as big-endian (false parameter)
	const bundleLength = new DataView(tickData.buffer, tickData.byteOffset + startPos + 9).getUint32(
		0,
		false
	); // false for big-endian

	let pos = 14;
	// The loop should not go past the end of the bundle's data
	while (startPos + pos + 2 <= tickData.length) {
		// Read action length as little-endian
		const actionLength = new DataView(
			tickData.buffer,
			tickData.byteOffset + startPos + pos
		).getInt16(0, true); // true for little-endian

		if (actionLength <= 0) {
			break; // Prevent infinite loop on zero-length action
		}

		// Check if the action data is fully contained within the buffer
		if (startPos + pos + actionLength > tickData.length) {
			break;
		}

		const actionData = tickData.subarray(startPos + pos, startPos + pos + actionLength);
		parseAction(actionData, tick, result);

		pos += actionLength;
	}

	return bundleLength + 13; // Return total size of the bundle structure
}

function parseAction(actionData: Uint8Array, tick: number, result: ParsedReplay) {
	if (actionData.length < 16) return;

	const dataView = new DataView(actionData.buffer, actionData.byteOffset, actionData.byteLength);

	const actionType = actionData[2];
	const baseLocation = actionData[3];

	// Read player ID using the same logic as the original parser
	const rawPlayerID = dataView.getUint16(4, true); // little-endian

	// Validate and convert player ID using the same logic as the complex parser
	let playerID: number;
	if (rawPlayerID >= 1000 && rawPlayerID < 1000 + result.players.length) {
		playerID = rawPlayerID;
	} else if (rawPlayerID === 0) {
		playerID = 0; // System
	} else {
		// Try different strategies like the original parser
		const altPlayerID = dataView.getUint16(6, true);
		if (altPlayerID >= 1000 && altPlayerID < 1000 + result.players.length) {
			playerID = altPlayerID;
		} else {
			const bytePlayerID = actionData[4];
			if (bytePlayerID >= 0 && bytePlayerID < result.players.length) {
				playerID = 1000 + bytePlayerID;
			} else {
				playerID = 0; // Default to system
			}
		}
	}

	const unitID = dataView.getUint16(10, true);
	const action = dataView.getUint16(14, true);

	let coordinates: { x: number; y: number; z: number } | undefined;
	if (actionData.length > 29) {
		coordinates = {
			x: dataView.getFloat32(18, true),
			y: dataView.getFloat32(22, true),
			z: dataView.getFloat32(26, true)
		};
	}

	result.actions.push({
		tick,
		playerID,
		actionType,
		action,
		coordinates
	});
}

function findPlayerDetails(result: ParsedReplay) {
	// Match player IDs from messages
	for (const player of result.players) {
		for (const message of result.messages) {
			if (message.playerName === player.name) {
				player.id = message.playerID;
				break;
			}
		}
	}

	// Find doctrines from actions
	for (const player of result.players) {
		for (const action of result.actions) {
			if (action.actionType === 0x62 && player.id === action.playerID && player.doctrine === 0) {
				player.doctrine = action.action;
				break;
			}
		}
	}
}

function parseGameDate(dateStr: string): Date {
	// European format: DD-MM-YYYY HH:mm
	const euroMatch = dateStr.match(/(\d\d).(\d\d).(\d\d\d\d)\s(\d\d).(\d\d)/);
	if (euroMatch) {
		return new Date(
			parseInt(euroMatch[3]), // year
			parseInt(euroMatch[2]) - 1, // month (0-based)
			parseInt(euroMatch[1]), // day
			parseInt(euroMatch[4]), // hour
			parseInt(euroMatch[5]) // minute
		);
	}

	// US format: MM/DD/YYYY hh:mm XM
	const usMatch = dateStr
		.toUpperCase()
		.match(/(\d{1,2}).(\d{1,2}).(\d\d\d\d)\s(\d{1,2}).(\d{1,2}).*?(\w)M/);
	if (usMatch) {
		let date = new Date(
			parseInt(usMatch[3]), // year
			parseInt(usMatch[1]) - 1, // month (0-based)
			parseInt(usMatch[2]), // day
			parseInt(usMatch[4]), // hour
			parseInt(usMatch[5]) // minute
		);

		if (usMatch[6] === 'P' && parseInt(usMatch[4]) < 12) {
			date.setHours(date.getHours() + 12);
		}
		if (usMatch[6] === 'A' && parseInt(usMatch[4]) === 12) {
			date.setHours(date.getHours() - 12);
			date.setDate(date.getDate() + 1);
		}
		return date;
	}

	// Asian format: YYYY/MM/DD HH:MM
	const asianMatch = dateStr.match(/(\d\d\d\d).(\d\d).(\d\d)\s(\d\d).(\d\d)/);
	if (asianMatch) {
		return new Date(
			parseInt(asianMatch[1]), // year
			parseInt(asianMatch[2]) - 1, // month (0-based)
			parseInt(asianMatch[3]), // day
			parseInt(asianMatch[4]), // hour
			parseInt(asianMatch[5]) // minute
		);
	}

	return new Date();
}

function formatTime(tick: number): string {
	const totalMs = ((10000000 / 8) * tick) / 10000;
	const hours = Math.floor(totalMs / 3600000);
	const minutes = Math.floor((totalMs % 3600000) / 60000);
	const seconds = Math.floor((totalMs % 60000) / 1000);

	// Compatible padding function
	const pad = (num: number): string => (num < 10 ? '0' : '') + num;

	return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatMapName(mapName: string): string {
	// Simple map name formatting - you can expand this based on your needs
	const match = mapName.match(/^(\d+)p_(.+)$/);
	if (match) {
		const [, playerCount, name] = match;
		const formattedName = name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
		return `${formattedName} (${playerCount})`;
	}
	return mapName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function calculateTeams(
	players: Array<{ name: string; faction: string; id: number; doctrine: number }>
): [
	Array<{ name: string; faction: string; id: number; doctrine: number }>,
	Array<{ name: string; faction: string; id: number; doctrine: number }>
] {
	const allies: Array<{ name: string; faction: string; id: number; doctrine: number }> = [];
	const axis: Array<{ name: string; faction: string; id: number; doctrine: number }> = [];

	players.forEach((player) => {
		if (player.faction.indexOf('allies') === 0) {
			// Compatible with older JS - using indexOf instead of startsWith
			allies.push(player);
		} else {
			axis.push(player);
		}
	});

	return [axis, allies];
}
