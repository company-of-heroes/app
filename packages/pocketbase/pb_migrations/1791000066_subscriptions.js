/// <reference path="../pb_data/types.d.ts" />

// Paddle supporter subscriptions. Both collections are written only by the website's webhook
// (superuser); no API rules, so clients never read them directly. `subscriptions.cancelAt` is
// when a subscription cancelled at period end stops (Paddle `scheduled_change`).
// `users.supporterHidden` hides a supporter from the public supporters page. Schema only.

const idField = (prefix) => ({
	autogeneratePattern: '[a-z0-9]{15}',
	hidden: false,
	id: `text_${prefix}_id`,
	max: 15,
	min: 15,
	name: 'id',
	pattern: '^[a-z0-9]+$',
	presentable: false,
	primaryKey: true,
	required: true,
	system: true,
	type: 'text'
});

const textField = (prefix, name, required) => ({
	autogeneratePattern: '',
	hidden: false,
	id: `text_${prefix}_${name}`,
	max: 0,
	min: 0,
	name,
	pattern: '',
	presentable: false,
	primaryKey: false,
	required,
	system: false,
	type: 'text'
});

const dateField = (prefix, name, required) => ({
	hidden: false,
	id: `date_${prefix}_${name}`,
	max: '',
	min: '',
	name,
	presentable: false,
	required,
	system: false,
	type: 'date'
});

const autodates = (prefix) => [
	{
		hidden: false,
		id: `autodate_${prefix}_created`,
		name: 'created',
		onCreate: true,
		onUpdate: false,
		presentable: false,
		system: false,
		type: 'autodate'
	},
	{
		hidden: false,
		id: `autodate_${prefix}_updated`,
		name: 'updated',
		onCreate: true,
		onUpdate: true,
		presentable: false,
		system: false,
		type: 'autodate'
	}
];

const userRelation = (prefix, usersId) => ({
	cascadeDelete: true,
	collectionId: usersId,
	hidden: false,
	id: `relation_${prefix}_user`,
	maxSelect: 1,
	minSelect: 0,
	name: 'user',
	presentable: false,
	required: true,
	system: false,
	type: 'relation'
});

const hasCollection = (app, name) => {
	try {
		app.findCollectionByNameOrId(name);
		return true;
	} catch {
		return false;
	}
};

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('_pb_users_auth_');
		if (!users.fields.getByName('supporterHidden')) {
			users.fields.add(
				new Field({
					hidden: false,
					id: 'bool_users_supporter_hidden',
					name: 'supporterHidden',
					presentable: false,
					required: false,
					system: false,
					type: 'bool'
				})
			);
			app.save(users);
		}

		if (!hasCollection(app, 'subscriptions')) {
			app.save(
				new Collection({
					createRule: null,
					deleteRule: null,
					listRule: null,
					viewRule: null,
					updateRule: null,
					name: 'subscriptions',
					type: 'base',
					indexes: [
						'CREATE UNIQUE INDEX `idx_subscriptions_user` ON `subscriptions` (`user`)',
						'CREATE UNIQUE INDEX `idx_subscriptions_paddle_subscription` ON `subscriptions` (`paddleSubscriptionId`)'
					],
					fields: [
						idField('subscriptions'),
						userRelation('subscriptions', users.id),
						textField('subscriptions', 'paddleCustomerId', false),
						textField('subscriptions', 'paddleSubscriptionId', true),
						{
							hidden: false,
							id: 'select_subscriptions_status',
							maxSelect: 1,
							name: 'status',
							presentable: false,
							required: true,
							system: false,
							type: 'select',
							values: ['active', 'past_due', 'paused', 'canceled']
						},
						dateField('subscriptions', 'currentPeriodEnd', false),
						dateField('subscriptions', 'canceledAt', false),
						dateField('subscriptions', 'cancelAt', false),
						dateField('subscriptions', 'paddleUpdatedAt', false),
						...autodates('subscriptions')
					]
				})
			);
		} else {
			const subscriptions = app.findCollectionByNameOrId('subscriptions');
			if (!subscriptions.fields.getByName('cancelAt')) {
				subscriptions.fields.add(new Field(dateField('subscriptions', 'cancelAt', false)));
				app.save(subscriptions);
			}
		}

		if (!hasCollection(app, 'subscription_payments')) {
			app.save(
				new Collection({
					createRule: null,
					deleteRule: null,
					listRule: null,
					viewRule: null,
					updateRule: null,
					name: 'subscription_payments',
					type: 'base',
					indexes: [
						'CREATE UNIQUE INDEX `idx_subscription_payments_transaction` ON `subscription_payments` (`paddleTransactionId`)',
						'CREATE INDEX `idx_subscription_payments_user` ON `subscription_payments` (`user`)'
					],
					fields: [
						idField('subscription_payments'),
						userRelation('subscription_payments', users.id),
						textField('subscription_payments', 'paddleTransactionId', true),
						{
							hidden: false,
							id: 'number_subscription_payments_amount',
							max: null,
							min: 0,
							name: 'amount',
							onlyInt: true,
							presentable: false,
							required: false,
							system: false,
							type: 'number'
						},
						textField('subscription_payments', 'currency', false),
						dateField('subscription_payments', 'paidAt', true),
						...autodates('subscription_payments')
					]
				})
			);
		}
	},
	(app) => {
		for (const name of ['subscription_payments', 'subscriptions']) {
			try {
				app.delete(app.findCollectionByNameOrId(name));
			} catch {
				// already gone
			}
		}

		const users = app.findCollectionByNameOrId('_pb_users_auth_');
		if (users.fields.getByName('supporterHidden')) {
			users.fields.removeByName('supporterHidden');
			app.save(users);
		}
	}
);
