/// <reference path="../pb_data/types.d.ts" />

// Uploaded champion medals (`tournament_medals`, PNG or SVG), added by staff and hosts and usable
// by every tournament. A tournament refers to one as `custom:<id>` in `medal`. Schema only.
const C = 'tournament_medals';
const MEDAL_PATTERN = {
	old: '^(medal-[0-9]{3})?$',
	next: '^(medal-[0-9]{3}|custom:[a-z0-9]{15})?$'
};

migrate(
	(app) => {
		try {
			app.findCollectionByNameOrId(C);
		} catch {
			app.save(
				new Collection({
					createRule: null,
					deleteRule: null,
					updateRule: null,
					listRule: '',
					viewRule: '',
					name: C,
					type: 'base',
					indexes: [`CREATE INDEX \`idx_${C}_name\` ON \`${C}\` (\`name\`)`],
					fields: [
						{
							autogeneratePattern: '[a-z0-9]{15}',
							hidden: false,
							id: `text_${C}_id`,
							max: 15,
							min: 15,
							name: 'id',
							pattern: '^[a-z0-9]+$',
							presentable: false,
							primaryKey: true,
							required: true,
							system: true,
							type: 'text'
						},
						{
							autogeneratePattern: '',
							hidden: false,
							id: `text_${C}_name`,
							max: 80,
							min: 0,
							name: 'name',
							pattern: '',
							presentable: true,
							primaryKey: false,
							required: true,
							system: false,
							type: 'text'
						},
						{
							hidden: false,
							id: `file_${C}_image`,
							maxSelect: 1,
							maxSize: 1024 * 1024,
							mimeTypes: ['image/png', 'image/svg+xml'],
							name: 'image',
							presentable: false,
							protected: false,
							required: true,
							system: false,
							thumbs: [],
							type: 'file'
						},
						{
							cascadeDelete: false,
							collectionId: '_pb_users_auth_',
							hidden: false,
							id: `relation_${C}_createdBy`,
							maxSelect: 1,
							minSelect: 0,
							name: 'createdBy',
							presentable: false,
							required: false,
							system: false,
							type: 'relation'
						},
						{
							hidden: false,
							id: `autodate_${C}_created`,
							name: 'created',
							onCreate: true,
							onUpdate: false,
							presentable: false,
							system: false,
							type: 'autodate'
						},
						{
							hidden: false,
							id: `autodate_${C}_updated`,
							name: 'updated',
							onCreate: true,
							onUpdate: true,
							presentable: false,
							system: false,
							type: 'autodate'
						}
					]
				})
			);
		}

		const tournaments = app.findCollectionByNameOrId('tournaments');
		const medal = tournaments.fields.getByName('medal');
		if (medal) {
			medal.max = 40;
			medal.pattern = MEDAL_PATTERN.next;
			app.save(tournaments);
		}
	},
	(app) => {
		const tournaments = app.findCollectionByNameOrId('tournaments');
		const medal = tournaments.fields.getByName('medal');
		if (medal) {
			medal.max = 20;
			medal.pattern = MEDAL_PATTERN.old;
			app.save(tournaments);
		}

		try {
			app.delete(app.findCollectionByNameOrId(C));
		} catch {
			// Already gone.
		}
	}
);
