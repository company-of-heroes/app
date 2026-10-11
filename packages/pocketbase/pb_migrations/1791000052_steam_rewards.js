/// <reference path="../pb_data/types.d.ts" />

// Rewards are unlocked per Steam ID instead of per user: steam_rewards holds one row per
// (steamId, reward). The website's rewards-evaluate job fills it: clearing
// users.rewardsCheckedAt queues every user (a small table; the job does the work in
// batches). user_rewards stays for now: the job reads it so re-earned rewards keep their
// date and do not notify again.
migrate(
	(app) => {
		try {
			app.findCollectionByNameOrId('steam_rewards');
			return;
		} catch {
			// create below
		}

		const admin = '@request.auth.role = "admin"';
		const rewards = app.findCollectionByNameOrId('rewards');
		const unlocks = new Collection({
			createRule: null,
			deleteRule: null,
			listRule: admin,
			viewRule: admin,
			updateRule: null,
			name: 'steam_rewards',
			type: 'base',
			id: 'pbc_steam_rewards',
			indexes: [
				'CREATE UNIQUE INDEX `idx_steam_rewards_steam_reward` ON `steam_rewards` (`steamId`, `reward`)',
				'CREATE INDEX `idx_steam_rewards_reward` ON `steam_rewards` (`reward`)'
			],
			fields: [
				{
					autogeneratePattern: '[a-z0-9]{15}',
					hidden: false,
					id: 'text_steam_rewards_id',
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
					id: 'text_steam_rewards_steam_id',
					max: 17,
					min: 17,
					name: 'steamId',
					pattern: '^[0-9]{17}$',
					presentable: false,
					primaryKey: false,
					required: true,
					system: false,
					type: 'text'
				},
				{
					cascadeDelete: true,
					collectionId: rewards.id,
					hidden: false,
					id: 'relation_steam_rewards_reward',
					maxSelect: 1,
					minSelect: 1,
					name: 'reward',
					presentable: false,
					required: true,
					system: false,
					type: 'relation'
				},
				{
					hidden: false,
					id: 'date_steam_rewards_unlocked',
					max: '',
					min: '',
					name: 'unlockedAt',
					presentable: false,
					required: true,
					system: false,
					type: 'date'
				},
				{
					hidden: false,
					id: 'autodate_steam_rewards_created',
					name: 'created',
					onCreate: true,
					onUpdate: false,
					presentable: false,
					system: false,
					type: 'autodate'
				},
				{
					hidden: false,
					id: 'autodate_steam_rewards_updated',
					name: 'updated',
					onCreate: true,
					onUpdate: true,
					presentable: false,
					system: false,
					type: 'autodate'
				}
			]
		});
		app.save(unlocks);
		app.db().newQuery("UPDATE users SET rewardsCheckedAt = ''").execute();
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('steam_rewards'));
		} catch {
			// already gone
		}
	}
);
