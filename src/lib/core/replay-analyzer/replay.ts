import { md5, normalizeMapName } from '$lib/utils.js';
import type { ActionDefinitions } from './action-definitions.js';
import ReplayStream from './replay-stream.js';

class Header {
	fileName: string;
	replayVersion: number;
	gameType: string;
	gameDate: Date;
	modName: string;
	mapFileName: string;
	mapName: string;
	mapDescription: string;
	mapWidth: number;
	mapHeight: number;
	replayName: string;
	MD5Hash: string;
	matchType: string;
	highResources: boolean;
	randomStart: boolean;
	vpCount: number;
	VPgame: boolean;

	constructor() {
		this.fileName = '';
		this.replayVersion = 0;
		this.gameType = '';
		this.gameDate = new Date();
		this.modName = '';
		this.mapFileName = '';
		this.mapName = '';
		this.mapDescription = '';
		this.mapWidth = 0;
		this.mapHeight = 0;
		this.replayName = '';
		this.MD5Hash = '';
		this.matchType = '';
		this.highResources = false;
		this.randomStart = false;
		this.vpCount = 0;
		this.VPgame = false;
	}
}

export class Message {
	tick: number;
	playerName: string;
	playerID: number;
	text: string;
	recipient: number;

	constructor(tick = 0, playerName = '', playerID = 0, text = '', recipient = 0) {
		this.tick = tick;
		this.playerName = playerName;
		this.playerID = playerID;
		this.text = text;
		this.recipient = recipient;
	}

	get timeStamp() {
		const totalMilliseconds = ((10000000 / 8) * this.tick) / 10000;
		const hours = Math.floor(totalMilliseconds / 3600000);
		const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
		const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}

	static get chatTarget() {
		return { All: 0, Team: 1, System: 2 };
	}
}

export class Player {
	name: string;
	faction: 'allies' | 'axis' | 'allies_commonwealth' | 'axis_panzer_elite';
	id: number;
	doctrine: number;

	constructor(name = '', faction: Player['faction'] = 'allies', id = 0, doctrine = 0) {
		this.name = name;
		this.faction = faction;
		this.id = id;
		this.doctrine = doctrine;
	}
}

export class Coordinate {
	x: number;
	y: number;
	z: number;

	constructor() {
		this.x = NaN;
		this.y = NaN;
		this.z = NaN;
	}

	toString() {
		return `(${this.x}, ${this.y}, ${this.z})`;
	}
}

export class Action {
	tick: number;
	length: number;
	actionType: number;
	baseLocation: number;
	action: number;
	playerID: number;
	unitID: number;
	data: Uint8Array | null;
	dataView: DataView | null;
	coordinate1: Coordinate;
	coordinate2: Coordinate;
	actionDefinitions?: ActionDefinitions;
	replay?: Replay; // Reference to the replay for validation

	constructor(
		tick = 0,
		data: Uint8Array | null = null,
		actionDefinitions?: ActionDefinitions,
		replay?: Replay
	) {
		this.tick = tick;
		this.length = 0;
		this.actionType = 0;
		this.baseLocation = 0;
		this.action = 0;
		this.playerID = 0;
		this.unitID = 0;
		this.data = data;
		this.dataView = data ? new DataView(data.buffer, data.byteOffset, data.byteLength) : null;
		this.coordinate1 = new Coordinate();
		this.coordinate2 = new Coordinate();
		this.actionDefinitions = actionDefinitions;
		this.replay = replay;

		if (data && this.dataView) {
			this.length = data.length;

			if (this.length > 16) {
				this.actionType = data[2];
				this.baseLocation = data[3];

				// Read the raw uint16 at offset 4
				const rawPlayerID = this.dataView.getUint16(4, true);

				// Determine the maximum valid player ID based on actual player count
				const maxValidPlayerID = this.replay ? 1000 + this.replay.playerCount - 1 : 1007;

				// Check if the raw value is already in the valid range
				if (rawPlayerID >= 1000 && rawPlayerID <= maxValidPlayerID) {
					this.playerID = rawPlayerID;
				} else if (rawPlayerID === 0) {
					this.playerID = 0; // System
				} else {
					// Try different strategies to extract valid player ID
					// Strategy 1: Check offset 6 instead
					const altPlayerID = this.dataView.getUint16(6, true);
					if (altPlayerID >= 1000 && altPlayerID <= maxValidPlayerID) {
						this.playerID = altPlayerID;
					} else {
						// Strategy 2: Extract lower byte and validate against player count
						const bytePlayerID = data[4];
						if (this.replay && bytePlayerID >= 0 && bytePlayerID < this.replay.playerCount) {
							this.playerID = 1000 + bytePlayerID;
						} else {
							// Fallback: set to 0 (system) for invalid values
							this.playerID = 0;
						}
					}
				}

				this.unitID = this.dataView.getUint16(10, true);
				this.action = this.dataView.getUint16(14, true);

				if (this.length > 29) {
					this.coordinate1.x = this.dataView.getFloat32(18, true);
					this.coordinate1.y = this.dataView.getFloat32(22, true);
					this.coordinate1.z = this.dataView.getFloat32(26, true);

					if (this.length > 41) {
						this.coordinate2.x = this.dataView.getFloat32(30, true);
						this.coordinate2.y = this.dataView.getFloat32(34, true);
						this.coordinate2.z = this.dataView.getFloat32(38, true);
					}
				}
			}
		}
	}

	get timeStamp() {
		const totalMilliseconds = ((10000000 / 8) * this.tick) / 10000;
		const hours = Math.floor(totalMilliseconds / 3600000);
		const minutes = Math.floor((totalMilliseconds % 3600000) / 60000);
		const seconds = Math.floor((totalMilliseconds % 60000) / 1000);
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}

	get actionTypeText() {
		return this.actionDefinitions ? this.actionDefinitions.getActionTypeText(this.actionType) : '';
	}

	get actionText() {
		return this.actionDefinitions
			? this.actionDefinitions.getActionText(this.actionType, this.action)
			: '';
	}

	get actionHasLocation() {
		return this.actionDefinitions
			? this.actionDefinitions.getActionHasLocation(this.actionType, this.action)
			: false;
	}

	tickToTime(tick: number) {
		return new Date(((10000000 / 8) * tick) / 10000);
	}
}

export class Tick {
	data: Uint8Array;
	dataView: DataView;
	tick: number;
	length: number;
	index: number;
	bundleCount: number;

	constructor(data: Uint8Array) {
		this.data = data;
		this.dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);
		this.tick = this.dataView.getUint32(0, true); // true for little-endian
		this.length = this.dataView.getUint32(4, true);
		this.index = this.dataView.getUint32(8, true);
		this.bundleCount = this.dataView.getUint32(12, true);
	}
}

export class Replay {
	header: Header;
	players: Player[];
	messages: Message[];
	actions: Action[];
	headerParsed: boolean;
	actionDefinitions?: ActionDefinitions;
	replayStream?: ReplayStream;
	duration: number;

	constructor(replayStream: ReplayStream, actionDefinitions?: ActionDefinitions) {
		this.header = new Header();
		this.header.MD5Hash = md5(
			Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
		);
		this.players = [];
		this.messages = [];
		this.actions = [];
		this.headerParsed = false;
		this.actionDefinitions = actionDefinitions;
		this.duration = 0;

		this.replayStream = replayStream;
		this.fileName = replayStream.fileName.split('/').pop() || 'unknown.rec';
	}

	static async load(fileName: string, actionDefinitions?: ActionDefinitions) {
		const replayStream = await ReplayStream.load(fileName);
		return new Replay(replayStream, actionDefinitions);
	}

	// Header properties
	get fileName() {
		return this.header.fileName;
	}
	set fileName(value) {
		this.header.fileName = value;
	}

	get replayVersion() {
		return this.header.replayVersion;
	}
	set replayVersion(value) {
		this.header.replayVersion = value;
	}

	get gameType() {
		return this.header.gameType;
	}
	set gameType(value) {
		this.header.gameType = value;
	}

	get gameDate() {
		return this.header.gameDate;
	}
	set gameDate(value) {
		this.header.gameDate = value;
	}

	get modName() {
		return this.header.modName;
	}
	set modName(value) {
		this.header.modName = value;
	}

	get mapFileName() {
		return this.header.mapFileName;
	}
	set mapFileName(value) {
		this.header.mapFileName = value;
	}

	get mapName() {
		return this.header.mapName;
	}
	set mapName(value) {
		this.header.mapName = value;
	}

	get mapNameFormatted() {
		return normalizeMapName(this!.mapFileName.split('\\').pop()!);
	}

	get mapDescription() {
		return this.header.mapDescription;
	}
	set mapDescription(value) {
		this.header.mapDescription = value;
	}

	get mapWidth() {
		return this.header.mapWidth;
	}
	set mapWidth(value) {
		this.header.mapWidth = value;
	}

	get mapHeight() {
		return this.header.mapHeight;
	}
	set mapHeight(value) {
		this.header.mapHeight = value;
	}

	get replayName() {
		return this.header.replayName;
	}
	set replayName(value) {
		this.header.replayName = value;
	}

	get MD5Hash() {
		return this.header.MD5Hash;
	}

	set MD5Hash(value) {
		this.header.MD5Hash = value;
	}

	get matchType() {
		return this.header.matchType;
	}
	set matchType(value) {
		this.header.matchType = value;
	}

	get highResources() {
		return this.header.highResources;
	}
	set highResources(value) {
		this.header.highResources = value;
	}

	get randomStart() {
		return this.header.randomStart;
	}
	set randomStart(value) {
		this.header.randomStart = value;
	}

	get vpCount() {
		return this.header.vpCount;
	}
	set vpCount(value) {
		this.header.vpCount = value;
	}

	get VPgame() {
		return this.header.VPgame;
	}
	set VPgame(value) {
		this.header.VPgame = value;
	}

	// Count properties
	get playerCount() {
		return this.players.length;
	}
	get messageCount() {
		return this.messages.length;
	}
	get actionCount() {
		return this.actions.length;
	}

	get teams() {
		const allies: Player[] = [];
		const axis: Player[] = [];

		this.players.forEach((player) => {
			if (player.faction.startsWith('allies')) {
				allies.push(player);
			} else {
				axis.push(player);
			}
		});

		return [axis, allies];
	}

	addPlayer(name: string, faction: Player['faction'], id = 0, doctrine = 0) {
		const player = new Player(name, faction, id, doctrine);
		this.players.push(player);
		return player;
	}

	addMessage(
		tick: number,
		playerName: string,
		playerID: number,
		message: string,
		recipient: number
	) {
		const msg = new Message(tick, playerName, playerID, message, recipient);
		this.messages.push(msg);
		return msg;
	}

	addAction(tick: number, data: Uint8Array) {
		const action = new Action(tick, data, this.actionDefinitions, this);
		this.actions.push(action);
		return action;
	}

	*playerIterator() {
		for (const player of this.players) {
			yield player;
		}
	}

	*messageIterator() {
		for (const message of this.messages) {
			yield message;
		}
	}

	*actionIterator() {
		for (const action of this.actions) {
			yield action;
		}
	}

	toDataSet() {
		// JavaScript doesn't have DataSet, return a plain object structure
		return {
			replay: [this.header],
			players: this.players.map((p) => ({ ...p, md5hash: this.MD5Hash })),
			messages: this.messages.map((m) => ({ ...m, md5hash: this.MD5Hash })),
			actions: this.actions.map((a) => ({
				...a,
				md5hash: this.MD5Hash,
				coordinate1: a.coordinate1,
				coordinate2: a.coordinate2
			}))
		};
	}
}
