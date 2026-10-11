/// <reference path="../pb_data/types.d.ts" />

// A reward can show a service ribbon instead of an uploaded image: a file name from
// `shared-assets/ribbons` (e.g. `ribbon-042`), picked by staff. Empty uses the image.

migrate(
	(app) => {
		const rewards = app.findCollectionByNameOrId('rewards');
		if (rewards.fields.getByName('ribbon')) {
			return;
		}

		rewards.fields.add(
			new Field({
				autogeneratePattern: '',
				hidden: false,
				id: 'text_rewards_ribbon',
				max: 20,
				min: 0,
				name: 'ribbon',
				pattern: '^(ribbon-[0-9]{3})?$',
				presentable: false,
				primaryKey: false,
				required: false,
				system: false,
				type: 'text'
			})
		);
		app.save(rewards);
	},
	(app) => {
		const rewards = app.findCollectionByNameOrId('rewards');
		rewards.fields.removeByName('ribbon');
		app.save(rewards);
	}
);
