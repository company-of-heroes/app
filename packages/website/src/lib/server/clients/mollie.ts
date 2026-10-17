import { errAsync, okAsync } from 'neverthrow';
import { z } from 'zod';
import { upstream } from '../errors';
import { fromAsync, type Task } from '../result';

const API_BASE = 'https://api.mollie.com/v2';

export type MollieAmount = { currency: string; value: string };

const amount = z.looseObject({ currency: z.string(), value: z.string() });
const metadata = z.record(z.string(), z.unknown()).nullish();

const customerSchema = z.looseObject({ id: z.string().min(1) });

const paymentSchema = z.looseObject({
	id: z.string().min(1),
	status: z.enum(['open', 'canceled', 'pending', 'authorized', 'expired', 'failed', 'paid']),
	sequenceType: z.enum(['oneoff', 'first', 'recurring']),
	amount,
	customerId: z.string().nullish(),
	mandateId: z.string().nullish(),
	subscriptionId: z.string().nullish(),
	metadata,
	createdAt: z.string(),
	paidAt: z.string().nullish(),
	_links: z.looseObject({ checkout: z.looseObject({ href: z.string() }).nullish() }).nullish()
});

const subscriptionSchema = z.looseObject({
	id: z.string().min(1),
	status: z.enum(['pending', 'active', 'canceled', 'suspended', 'completed']),
	startDate: z.string(),
	/** Absent once the subscription is cancelled or completed. */
	nextPaymentDate: z.string().nullish()
});

const mandateSchema = z.looseObject({
	id: z.string().min(1),
	status: z.enum(['valid', 'pending', 'invalid'])
});

export type MolliePayment = z.infer<typeof paymentSchema>;
export type MollieSubscription = z.infer<typeof subscriptionSchema>;
export type MollieMandate = z.infer<typeof mandateSchema>;

/**
 * Mollie API (payments, customers, subscriptions, mandates). The API key decides the mode:
 * `test_…` talks to test mode, `live_…` charges for real. Webhooks carry only an id; the
 * payment is fetched here, which is what makes a webhook trustworthy.
 */
export class MollieClient {
	constructor(
		private readonly fetch: typeof globalThis.fetch,
		private readonly apiKey: string
	) {}

	get configured(): boolean {
		return Boolean(this.apiKey);
	}

	/** A JSON call; a 404 or 410 yields null, any other failure a 502. */
	private request<T>(
		schema: z.ZodType<T>,
		method: string,
		path: string,
		body?: Record<string, unknown>
	): Task<T | null> {
		if (!this.configured) {
			return errAsync(upstream('Mollie is not configured'));
		}

		return fromAsync(
			this.fetch(`${API_BASE}${path}`, {
				method,
				headers: {
					authorization: `Bearer ${this.apiKey}`,
					...(body ? { 'content-type': 'application/json' } : {})
				},
				body: body ? JSON.stringify(body) : undefined
			}),
			'Mollie unreachable',
			502
		).andThen((response): Task<T | null> => {
			if (response.status === 404 || response.status === 410) {
				return okAsync(null);
			}

			if (!response.ok) {
				return fromAsync(response.text(), 'Mollie failed', 502).andThen((text) => {
					console.error('[mollie]', method, path, response.status, text.slice(0, 500));
					return errAsync(upstream(`Mollie failed (${response.status})`));
				});
			}

			if (response.status === 204) {
				return okAsync(null);
			}

			return fromAsync(response.json(), 'Mollie sent invalid JSON', 502).andThen((data) => {
				const parsed = schema.safeParse(data);
				if (!parsed.success) {
					console.error('[mollie] unexpected response', method, path, parsed.error.message);
					return errAsync(upstream('Mollie sent an unexpected response'));
				}

				return okAsync(parsed.data);
			});
		});
	}

	/** Like `request`, but a missing object is an error too. */
	private required<T>(
		schema: z.ZodType<T>,
		method: string,
		path: string,
		body?: Record<string, unknown>
	): Task<T> {
		return this.request(schema, method, path, body).andThen((value) =>
			value ? okAsync(value) : errAsync(upstream('Mollie could not find it'))
		);
	}

	createCustomer(input: {
		email?: string;
		metadata: Record<string, string>;
	}): Task<{ id: string }> {
		return this.required(customerSchema, 'POST', '/customers', input);
	}

	createPayment(input: {
		amount: MollieAmount;
		description: string;
		redirectUrl: string;
		webhookUrl?: string;
		sequenceType: 'first';
		customerId: string;
		metadata: Record<string, string>;
	}): Task<MolliePayment> {
		return this.required(paymentSchema, 'POST', '/payments', input);
	}

	/** Null for an unknown id. */
	getPayment(id: string): Task<MolliePayment | null> {
		return this.request(paymentSchema, 'GET', `/payments/${encodeURIComponent(id)}`);
	}

	createSubscription(
		customerId: string,
		input: {
			amount: MollieAmount;
			interval: string;
			startDate: string;
			description: string;
			mandateId: string;
			webhookUrl?: string;
			metadata: Record<string, string>;
		}
	): Task<MollieSubscription> {
		return this.required(
			subscriptionSchema,
			'POST',
			`/customers/${encodeURIComponent(customerId)}/subscriptions`,
			input
		);
	}

	/** Null for an unknown subscription. */
	getSubscription(customerId: string, id: string): Task<MollieSubscription | null> {
		return this.request(
			subscriptionSchema,
			'GET',
			`/customers/${encodeURIComponent(customerId)}/subscriptions/${encodeURIComponent(id)}`
		);
	}

	/** Cancels a subscription; one Mollie no longer knows (or already cancelled) counts as done. */
	cancelSubscription(customerId: string, id: string): Task<void> {
		return this.request(
			subscriptionSchema,
			'DELETE',
			`/customers/${encodeURIComponent(customerId)}/subscriptions/${encodeURIComponent(id)}`
		)
			.map(() => undefined)
			.orElse((error) =>
				// Mollie answers 422 for a subscription that is already cancelled.
				error.message.includes('(422)') ? okAsync(undefined) : errAsync(error)
			);
	}

	/** Null for an unknown mandate. */
	getMandate(customerId: string, id: string): Task<MollieMandate | null> {
		return this.request(
			mandateSchema,
			'GET',
			`/customers/${encodeURIComponent(customerId)}/mandates/${encodeURIComponent(id)}`
		);
	}
}
