import ReplayStream from './ReplayStream.js';

class Header {
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
	constructor(name = '', faction = '', id = 0, doctrine = 0) {
		this.name = name;
		this.faction = faction;
		this.id = id;
		this.doctrine = doctrine;
	}
}

export class Coordinate {
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
	constructor(tick = 0, data = null, actionDefinitions = null) {
		this.tick = tick;
		this.length = 0;
		this.actionType = 0;
		this.baseLocation = 0;
		this.action = 0;
		this.playerID = 0;
		this.unitID = 0;
		this.data = data;
		this.coordinate1 = new Coordinate();
		this.coordinate2 = new Coordinate();
		this.actionDefinitions = actionDefinitions;

		if (data) {
			this.length = data.length;

			if (this.length > 16) {
				this.actionType = data[2];
				this.baseLocation = data[3];
				this.playerID = data.readUInt16LE(4);
				this.unitID = data.readUInt16LE(10);
				this.action = data.readUInt16LE(14);

				if (this.length > 29) {
					this.coordinate1.x = data.readFloatLE(18);
					this.coordinate1.y = data.readFloatLE(22);
					this.coordinate1.z = data.readFloatLE(26);

					if (this.length > 41) {
						this.coordinate2.x = data.readFloatLE(30);
						this.coordinate2.y = data.readFloatLE(34);
						this.coordinate2.z = data.readFloatLE(38);
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

	tickToTime(tick) {
		return new Date(((10000000 / 8) * tick) / 10000);
	}
}

export class Tick {
	constructor(data) {
		this.data = data;
		this.tick = data.readUInt32LE(0);
		this.length = data.readUInt32LE(4);
		this.index = data.readUInt32LE(8);
		this.bundleCount = data.readUInt32LE(12);
	}
}

export class Replay {
	constructor(fileName = '', actionDefinitions = null) {
		this.header = new Header();
		this.players = [];
		this.messages = [];
		this.actions = [];
		this.headerParsed = false;
		this.actionDefinitions = actionDefinitions;

		if (fileName) {
			this.replayStream = new ReplayStream(fileName);
			this.fileName = fileName;
			this.MD5Hash = this.replayStream.MD5hash;
		}
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

	addPlayer(name, faction, id = 0, doctrine = 0) {
		const player = new Player(name, faction, id, doctrine);
		this.players.push(player);
		return player;
	}

	addMessage(tick, playerName, playerID, message, recipient) {
		const msg = new Message(tick, playerName, playerID, message, recipient);
		this.messages.push(msg);
		return msg;
	}

	addAction(tick, data) {
		const action = new Action(tick, data, this.actionDefinitions);
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
