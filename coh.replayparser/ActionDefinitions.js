import fs from 'fs';

export class ActionDefinition {
	constructor(type, id, text, hasLocation) {
		this.type = type;
		this.id = id;
		this.text = text;
		this.hasLocation = hasLocation;
	}
}

export class ActionDefinitions {
	constructor(fileName) {
		this.fileName = fileName;
		this.actionDefinitions = new Map();
		this.load();
	}

	load() {
		const regex = /^(\d+)[,;](\d+?)[,;]"(.+?)"[,;](\d)$/;
		const content = fs.readFileSync(this.fileName, 'utf8');
		const lines = content.split('\n');

		for (const line of lines) {
			const trimmedLine = line.trim();
			if (regex.test(trimmedLine)) {
				const match = regex.exec(trimmedLine);
				const ad = new ActionDefinition(
					parseInt(match[1]),
					parseInt(match[2]),
					match[3],
					match[4] === '1'
				);

				if (!this.actionDefinitions.has(ad.type)) {
					this.actionDefinitions.set(ad.type, new Map());
				}

				if (!this.actionDefinitions.get(ad.type).has(ad.id)) {
					this.actionDefinitions.get(ad.type).set(ad.id, ad);
				}
			}
		}
	}

	save(fileName = null) {
		const targetFile = fileName || this.fileName;
		let content = '';

		for (const [type, typeMap] of this.actionDefinitions) {
			for (const [id, ad] of typeMap) {
				content += `${ad.type};${ad.id};"${ad.text}";${ad.hasLocation ? 1 : 0}\n`;
			}
		}

		fs.writeFileSync(targetFile, content);
		this.fileName = targetFile;
	}

	getActionTypeText(actionGroup) {
		return '';
	}

	getActionText(actionGroup, action) {
		if (this.actionDefinitions.has(actionGroup)) {
			const typeMap = this.actionDefinitions.get(actionGroup);
			if (typeMap.has(action)) {
				return typeMap.get(action).text;
			}
		}
		return 'UNKNOWN';
	}

	getActionHasLocation(actionGroup, action) {
		if (this.actionDefinitions.has(actionGroup)) {
			const typeMap = this.actionDefinitions.get(actionGroup);
			if (typeMap.has(action)) {
				return typeMap.get(action).hasLocation;
			}
		}
		return false;
	}

	*getIterator() {
		for (const [type, typeMap] of this.actionDefinitions) {
			for (const [id, ad] of typeMap) {
				yield ad;
			}
		}
	}
}
