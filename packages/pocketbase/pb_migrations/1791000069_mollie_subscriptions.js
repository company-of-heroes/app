/// <reference path="../pb_data/types.d.ts" />

// Supporter subscriptions move from Paddle to Mollie (never released on Paddle, so no data to
// carry over). Renames the provider ids, adds the mandate a cancelled subscription resumes on,
// and drops Paddle's event ordering field. `mollieSubscriptionId` may be empty (a first payment
// without a mandate pays one month only), so its unique index skips empty values. Schema only.

const renameField = (collection, from, to) => {
	const field = collection.fields.getByName(from);
	if (field) {
		field.name = to;
	}
};

migrate(
	(app) => {
		const subscriptions = app.findCollectionByNameOrId('subscriptions');
		renameField(subscriptions, 'paddleCustomerId', 'mollieCustomerId');
		renameField(subscriptions, 'paddleSubscriptionId', 'mollieSubscriptionId');
		const subscriptionId = subscriptions.fields.getByName('mollieSubscriptionId');
		if (subscriptionId) {
			subscriptionId.required = false;
		}

		if (!subscriptions.fields.getByName('mollieMandateId')) {
			subscriptions.fields.add(
				new Field({
					autogeneratePattern: '',
					hidden: false,
					id: 'text_subscriptions_mollieMandateId',
					max: 0,
					min: 0,
					name: 'mollieMandateId',
					pattern: '',
					presentable: false,
					primaryKey: false,
					required: false,
					system: false,
					type: 'text'
				})
			);
		}

		if (subscriptions.fields.getByName('paddleUpdatedAt')) {
			subscriptions.fields.removeByName('paddleUpdatedAt');
		}

		const status = subscriptions.fields.getByName('status');
		if (status) {
			status.values = ['active', 'past_due', 'canceled'];
		}

		subscriptions.indexes = [
			'CREATE UNIQUE INDEX `idx_subscriptions_user` ON `subscriptions` (`user`)',
			"CREATE UNIQUE INDEX `idx_subscriptions_mollie_subscription` ON `subscriptions` (`mollieSubscriptionId`) WHERE `mollieSubscriptionId` != ''",
			'CREATE INDEX `idx_subscriptions_mollie_customer` ON `subscriptions` (`mollieCustomerId`)'
		];
		app.save(subscriptions);

		const payments = app.findCollectionByNameOrId('subscription_payments');
		renameField(payments, 'paddleTransactionId', 'molliePaymentId');
		payments.indexes = [
			'CREATE UNIQUE INDEX `idx_subscription_payments_payment` ON `subscription_payments` (`molliePaymentId`)',
			'CREATE INDEX `idx_subscription_payments_user` ON `subscription_payments` (`user`)'
		];
		app.save(payments);
	},
	(app) => {
		const payments = app.findCollectionByNameOrId('subscription_payments');
		renameField(payments, 'molliePaymentId', 'paddleTransactionId');
		payments.indexes = [
			'CREATE UNIQUE INDEX `idx_subscription_payments_transaction` ON `subscription_payments` (`paddleTransactionId`)',
			'CREATE INDEX `idx_subscription_payments_user` ON `subscription_payments` (`user`)'
		];
		app.save(payments);

		const subscriptions = app.findCollectionByNameOrId('subscriptions');
		renameField(subscriptions, 'mollieCustomerId', 'paddleCustomerId');
		renameField(subscriptions, 'mollieSubscriptionId', 'paddleSubscriptionId');
		const subscriptionId = subscriptions.fields.getByName('paddleSubscriptionId');
		if (subscriptionId) {
			subscriptionId.required = true;
		}

		if (subscriptions.fields.getByName('mollieMandateId')) {
			subscriptions.fields.removeByName('mollieMandateId');
		}

		if (!subscriptions.fields.getByName('paddleUpdatedAt')) {
			subscriptions.fields.add(
				new Field({
					hidden: false,
					id: 'date_subscriptions_paddleUpdatedAt',
					max: '',
					min: '',
					name: 'paddleUpdatedAt',
					presentable: false,
					required: false,
					system: false,
					type: 'date'
				})
			);
		}

		const status = subscriptions.fields.getByName('status');
		if (status) {
			status.values = ['active', 'past_due', 'paused', 'canceled'];
		}

		subscriptions.indexes = [
			'CREATE UNIQUE INDEX `idx_subscriptions_user` ON `subscriptions` (`user`)',
			'CREATE UNIQUE INDEX `idx_subscriptions_paddle_subscription` ON `subscriptions` (`paddleSubscriptionId`)'
		];
		app.save(subscriptions);
	}
);
