/// <reference path="../pb_data/types.d.ts" />

// Steam-style rewards: admins define them (image, title, description, conditions);
// the website's rewards-evaluate job unlocks them into user_rewards. Schema only —
// existing users are evaluated by the job, not here.
const PREVIOUS_USERS_RULE =
	'id = @request.auth.id && @request.body.role:changed = false && @request.body.reputation:changed = false && @request.body.verified:changed = false && @request.body.email:changed = false';

migrate(
	(app) => {
		const admin = '@request.auth.role = "admin"';

		let rewards;
		try {
			rewards = app.findCollectionByNameOrId('rewards');
		} catch {
			rewards = new Collection({
				createRule: admin,
				deleteRule: admin,
				listRule: `enabled = true || ${admin}`,
				viewRule: `enabled = true || ${admin}`,
				updateRule: admin,
				name: 'rewards',
				type: 'base',
				id: 'pbc_rewards',
				indexes: ['CREATE INDEX `idx_rewards_enabled_sort` ON `rewards` (`enabled`, `sort`)'],
				fields: [
					{
						autogeneratePattern: '[a-z0-9]{15}',
						hidden: false,
						id: 'text_rewards_id',
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
						id: 'text_rewards_title',
						max: 80,
						min: 1,
						name: 'title',
						pattern: '',
						presentable: true,
						primaryKey: false,
						required: true,
						system: false,
						type: 'text'
					},
					{
						autogeneratePattern: '',
						hidden: false,
						id: 'text_rewards_description',
						max: 300,
						min: 0,
						name: 'description',
						pattern: '',
						presentable: false,
						primaryKey: false,
						required: false,
						system: false,
						type: 'text'
					},
					{
						hidden: false,
						id: 'file_rewards_image',
						maxSelect: 1,
						maxSize: 262144,
						mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
						name: 'image',
						presentable: false,
						protected: false,
						required: false,
						system: false,
						thumbs: ['150x150'],
						type: 'file'
					},
					{
						hidden: false,
						id: 'json_rewards_conditions',
						maxSize: 4000,
						name: 'conditions',
						presentable: false,
						required: true,
						system: false,
						type: 'json'
					},
					{
						hidden: false,
						id: 'bool_rewards_enabled',
						name: 'enabled',
						presentable: false,
						required: false,
						system: false,
						type: 'bool'
					},
					{
						hidden: false,
						id: 'bool_rewards_secret',
						name: 'secret',
						presentable: false,
						required: false,
						system: false,
						type: 'bool'
					},
					{
						hidden: false,
						id: 'number_rewards_sort',
						max: null,
						min: 0,
						name: 'sort',
						onlyInt: true,
						presentable: false,
						required: false,
						system: false,
						type: 'number'
					},
					{
						hidden: false,
						id: 'autodate_rewards_created',
						name: 'created',
						onCreate: true,
						onUpdate: false,
						presentable: false,
						system: false,
						type: 'autodate'
					},
					{
						hidden: false,
						id: 'autodate_rewards_updated',
						name: 'updated',
						onCreate: true,
						onUpdate: true,
						presentable: false,
						system: false,
						type: 'autodate'
					}
				]
			});
			app.save(rewards);
			rewards = app.findCollectionByNameOrId('rewards');
		}

		try {
			app.findCollectionByNameOrId('user_rewards');
		} catch {
			const unlocks = new Collection({
				createRule: null,
				deleteRule: null,
				listRule: admin,
				viewRule: admin,
				updateRule: null,
				name: 'user_rewards',
				type: 'base',
				id: 'pbc_user_rewards',
				indexes: [
					'CREATE UNIQUE INDEX `idx_user_rewards_user_reward` ON `user_rewards` (`user`, `reward`)',
					'CREATE INDEX `idx_user_rewards_reward` ON `user_rewards` (`reward`)'
				],
				fields: [
					{
						autogeneratePattern: '[a-z0-9]{15}',
						hidden: false,
						id: 'text_user_rewards_id',
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
						cascadeDelete: true,
						collectionId: '_pb_users_auth_',
						hidden: false,
						id: 'relation_user_rewards_user',
						maxSelect: 1,
						minSelect: 1,
						name: 'user',
						presentable: false,
						required: true,
						system: false,
						type: 'relation'
					},
					{
						cascadeDelete: true,
						collectionId: rewards.id,
						hidden: false,
						id: 'relation_user_rewards_reward',
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
						id: 'date_user_rewards_unlocked',
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
						id: 'autodate_user_rewards_created',
						name: 'created',
						onCreate: true,
						onUpdate: false,
						presentable: false,
						system: false,
						type: 'autodate'
					},
					{
						hidden: false,
						id: 'autodate_user_rewards_updated',
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
		}

		const users = app.findCollectionByNameOrId('users');
		if (!users.fields.getByName('rewardsCheckedAt')) {
			users.fields.add(
				new DateField({
					hidden: true,
					id: 'date_users_rewards_checked',
					max: '',
					min: '',
					name: 'rewardsCheckedAt',
					presentable: false,
					required: false,
					system: false
				})
			);
		}

		users.updateRule = `${PREVIOUS_USERS_RULE} && @request.body.rewardsCheckedAt:changed = false`;
		app.save(users);
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('user_rewards'));
		} catch {
			// already gone
		}

		try {
			app.delete(app.findCollectionByNameOrId('rewards'));
		} catch {
			// already gone
		}

		const users = app.findCollectionByNameOrId('users');
		if (users.fields.getByName('rewardsCheckedAt')) {
			users.fields.removeByName('rewardsCheckedAt');
		}

		users.updateRule = PREVIOUS_USERS_RULE;
		app.save(users);
	}
);
