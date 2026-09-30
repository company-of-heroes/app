/// <reference path="../pb_data/types.d.ts" />

function firstSteamId(value) {
	if (!value) {
		return '';
	}

	if (Array.isArray(value) && value.length) {
		return String(value[0] || '');
	}

	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed) && parsed.length) {
				return String(parsed[0] || '');
			}
		} catch {
			return value;
		}
	}

	return '';
}

migrate(
	(app) => {
		let records;
		try {
			records = app.findAllRecords('anti_cheat_captures');
		} catch {
			return;
		}

		for (const record of records) {
			if (!record || record.getString('steam_id')) {
				continue;
			}

			const userId = record.getString('user');
			if (!userId) {
				continue;
			}

			try {
				const user = app.findRecordById('users', userId);
				const steamId = firstSteamId(user.get('steamIds'));
				if (!steamId) {
					continue;
				}

				record.set('steam_id', steamId);
				app.save(record);
			} catch {
				// skip captures whose user is gone
			}
		}
	},
	() => {}
);
