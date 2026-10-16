/// <reference path="../pb_data/types.d.ts" />

// Rewards are only read directly by admins: the website loads them with the superuser
// client and hides secret ones itself. The old `enabled = true` rule let anyone list secret
// rewards' titles and conditions. Reward images are not protected files, so they stay
// public without a view rule. steam_rewards gets `pendingNotify`: unlocks are created with
// it set and it is cleared once the user has been notified. Schema only.
const ADMIN = '@request.auth.role = "admin"';
const PREVIOUS_READ_RULE = `enabled = true || ${ADMIN}`;

migrate(
	(app) => {
		const rewards = app.findCollectionByNameOrId('rewards');
		rewards.listRule = ADMIN;
		rewards.viewRule = ADMIN;
		app.save(rewards);

		const unlocks = app.findCollectionByNameOrId('steam_rewards');
		if (!unlocks.fields.getByName('pendingNotify')) {
			unlocks.fields.add(
				new BoolField({
					hidden: false,
					id: 'bool_steam_rewards_pending_notify',
					name: 'pendingNotify',
					presentable: false,
					required: false,
					system: false
				})
			);
			app.save(unlocks);
		}
	},
	(app) => {
		const rewards = app.findCollectionByNameOrId('rewards');
		rewards.listRule = PREVIOUS_READ_RULE;
		rewards.viewRule = PREVIOUS_READ_RULE;
		app.save(rewards);

		const unlocks = app.findCollectionByNameOrId('steam_rewards');
		if (unlocks.fields.getByName('pendingNotify')) {
			unlocks.fields.removeByName('pendingNotify');
			app.save(unlocks);
		}
	}
);
