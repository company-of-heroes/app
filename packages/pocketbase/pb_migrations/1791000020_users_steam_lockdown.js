/// <reference path="../pb_data/types.d.ts" />

// Steam ids are linked only through the website (POST /api/v1/account/steam-ids), which
// refuses ids another account already owns and records a steam_link_conflicts row for staff.
// The users list is no longer public: it exposed every account's Steam ids and role.
const PREVIOUS_UPDATE =
	'id = @request.auth.id && @request.body.role:changed = false && @request.body.reputation:changed = false && @request.body.verified:changed = false && @request.body.email:changed = false && @request.body.rewardsCheckedAt:changed = false';
const PREVIOUS_CREATE = '@request.body.role:isset = false';
const PREVIOUS_CUSTOMIZATION_CREATE =
	'@request.auth.id != "" && @request.body.user = @request.auth.id';
const PREVIOUS_CUSTOMIZATION_UPDATE = 'user = @request.auth.id';

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.listRule = '@request.auth.id != ""';
		users.createRule = `${PREVIOUS_CREATE} && @request.body.steamIds:isset = false`;
		users.updateRule = `${PREVIOUS_UPDATE} && @request.body.steamIds:changed = false`;
		app.save(users);

		const customizations = app.findCollectionByNameOrId('player_customizations');
		customizations.createRule = `${PREVIOUS_CUSTOMIZATION_CREATE} && @request.auth.steamIds ~ @request.body.steam_id`;
		customizations.updateRule = `${PREVIOUS_CUSTOMIZATION_UPDATE} && @request.body.steam_id:changed = false`;
		app.save(customizations);

		try {
			app.findCollectionByNameOrId('steam_link_conflicts');
		} catch {
			const conflicts = new Collection({
				createRule: null,
				deleteRule: null,
				listRule: null,
				viewRule: null,
				updateRule: null,
				name: 'steam_link_conflicts',
				type: 'base',
				id: 'pbc_steam_link_conflicts',
				indexes: [
					'CREATE UNIQUE INDEX `idx_steam_link_conflicts_user_steam` ON `steam_link_conflicts` (`user`, `steamId`)'
				],
				fields: [
					{
						autogeneratePattern: '[a-z0-9]{15}',
						hidden: false,
						id: 'text_steam_link_conflicts_id',
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
						id: 'relation_steam_link_conflicts_user',
						maxSelect: 1,
						minSelect: 1,
						name: 'user',
						presentable: false,
						required: true,
						system: false,
						type: 'relation'
					},
					{
						autogeneratePattern: '',
						hidden: false,
						id: 'text_steam_link_conflicts_steam',
						max: 20,
						min: 17,
						name: 'steamId',
						pattern: '^7656119\\d{10}$',
						presentable: false,
						primaryKey: false,
						required: true,
						system: false,
						type: 'text'
					},
					{
						hidden: false,
						id: 'json_steam_link_conflicts_owners',
						maxSize: 2000,
						name: 'owners',
						presentable: false,
						required: false,
						system: false,
						type: 'json'
					},
					{
						hidden: false,
						id: 'bool_steam_link_conflicts_resolved',
						name: 'resolved',
						presentable: false,
						required: false,
						system: false,
						type: 'bool'
					},
					{
						hidden: false,
						id: 'autodate_steam_link_conflicts_created',
						name: 'created',
						onCreate: true,
						onUpdate: false,
						presentable: false,
						system: false,
						type: 'autodate'
					},
					{
						hidden: false,
						id: 'autodate_steam_link_conflicts_updated',
						name: 'updated',
						onCreate: true,
						onUpdate: true,
						presentable: false,
						system: false,
						type: 'autodate'
					}
				]
			});
			app.save(conflicts);
		}
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('steam_link_conflicts'));
		} catch {
			// already gone
		}

		const customizations = app.findCollectionByNameOrId('player_customizations');
		customizations.createRule = PREVIOUS_CUSTOMIZATION_CREATE;
		customizations.updateRule = PREVIOUS_CUSTOMIZATION_UPDATE;
		app.save(customizations);

		const users = app.findCollectionByNameOrId('users');
		users.listRule = '';
		users.createRule = PREVIOUS_CREATE;
		users.updateRule = PREVIOUS_UPDATE;
		app.save(users);
	}
);
