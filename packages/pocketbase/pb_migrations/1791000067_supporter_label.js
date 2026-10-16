/// <reference path="../pb_data/types.d.ts" />

// System labels: `user_labels.system` locks a label's conditions and deletion in the admin UI,
// `user_labels.key` is a stable identifier (unique when set). Seeds the single Supporter label,
// granted by the website's rewards-evaluate job through the `supporter_active` metric.
// One row insert, no table scans.

migrate(
	(app) => {
		const labels = app.findCollectionByNameOrId('user_labels');
		let changed = false;
		if (!labels.fields.getByName('system')) {
			labels.fields.add(
				new Field({
					hidden: false,
					id: 'bool_user_labels_system',
					name: 'system',
					presentable: false,
					required: false,
					system: false,
					type: 'bool'
				})
			);
			changed = true;
		}

		if (!labels.fields.getByName('key')) {
			labels.fields.add(
				new Field({
					autogeneratePattern: '',
					hidden: false,
					id: 'text_user_labels_key',
					max: 40,
					min: 0,
					name: 'key',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				})
			);
			changed = true;
		}

		if (!labels.indexes.some((i) => i.includes('idx_user_labels_key'))) {
			labels.indexes.push(
				"CREATE UNIQUE INDEX `idx_user_labels_key` ON `user_labels` (`key`) WHERE `key` != ''"
			);
			changed = true;
		}

		if (changed) {
			app.save(labels);
		}

		let exists = true;
		try {
			app.findFirstRecordByData('user_labels', 'key', 'supporter');
		} catch {
			exists = false;
		}

		if (!exists) {
			const record = new Record(app.findCollectionByNameOrId('user_labels'));
			record.set('name', 'Supporter');
			record.set('key', 'supporter');
			record.set('system', true);
			record.set('color', '#E0B23A');
			record.set('tooltip', 'Supports coh1stats');
			record.set('conditions', [{ metric: 'supporter_active', threshold: 1 }]);
			app.save(record);
		}
	},
	(app) => {
		try {
			app.delete(app.findFirstRecordByData('user_labels', 'key', 'supporter'));
		} catch {
			// already gone
		}

		const labels = app.findCollectionByNameOrId('user_labels');
		labels.indexes = labels.indexes.filter((i) => !i.includes('idx_user_labels_key'));
		labels.fields.removeByName('key');
		labels.fields.removeByName('system');
		app.save(labels);
	}
);
