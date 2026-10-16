import { errAsync, okAsync } from 'neverthrow';
import { z } from 'zod';
import { upstream } from '../errors';
import { fetchJson, type Task } from '../result';

export type PaddleEnv = 'sandbox' | 'production';

const API_BASE: Record<PaddleEnv, string> = {
	sandbox: 'https://sandbox-api.paddle.com',
	production: 'https://api.paddle.com'
};

/** A signature older (or newer) than this is a replay or a skewed clock. */
const SIGNATURE_TOLERANCE_SECONDS = 300;

/** `production` only when set so; anything else talks to the sandbox. */
export function paddleEnv(value: string | undefined): PaddleEnv {
	return value === 'production' ? 'production' : 'sandbox';
}

/** Paddle Billing API, for the customer portal. Webhooks are verified with `verifyPaddleSignature`. */
export class PaddleClient {
	constructor(
		private readonly fetch: typeof globalThis.fetch,
		private readonly apiKey: string,
		private readonly env: PaddleEnv
	) {}

	get configured(): boolean {
		return Boolean(this.apiKey);
	}

	/** A customer portal session (cancel, change card) for one subscription; its overview url. */
	portalUrl(customerId: string, subscriptionId: string): Task<string> {
		if (!this.configured) {
			return errAsync(upstream('Paddle is not configured'));
		}

		return fetchJson<{ data?: { urls?: { general?: { overview?: string } } } }>(
			this.fetch,
			`${API_BASE[this.env]}/customers/${encodeURIComponent(customerId)}/portal-sessions`,
			{
				method: 'POST',
				headers: {
					authorization: `Bearer ${this.apiKey}`,
					'content-type': 'application/json'
				},
				body: JSON.stringify({ subscription_ids: [subscriptionId] })
			},
			'Paddle'
		).andThen((body) => {
			const url = body.data?.urls?.general?.overview;
			return url ? okAsync(url) : errAsync(upstream('Paddle sent no portal url'));
		});
	}
}

function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}

	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
	return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Checks a `Paddle-Signature: ts=…;h1=…` header: HMAC-SHA256 (hex) of `ts:rawBody` with the
 * webhook secret, and `ts` within five minutes of now. While Paddle rotates a secret the
 * header carries several `h1`; one match is enough.
 */
export async function verifyPaddleSignature(
	header: string | null,
	rawBody: string,
	secret: string,
	now = Date.now()
): Promise<boolean> {
	if (!header || !secret) {
		return false;
	}

	let ts = '';
	const signatures: string[] = [];
	for (const part of header.split(';')) {
		const [key, ...rest] = part.trim().split('=');
		const value = rest.join('=');
		if (key === 'ts') {
			ts = value;
		} else if (key === 'h1' && value) {
			signatures.push(value.toLowerCase());
		}
	}

	if (!/^\d+$/.test(ts) || signatures.length === 0) {
		return false;
	}

	if (Math.abs(now / 1000 - Number(ts)) > SIGNATURE_TOLERANCE_SECONDS) {
		return false;
	}

	const expected = await hmacHex(secret, `${ts}:${rawBody}`);
	return signatures.reduce(
		(match, signature) => constantTimeEqual(signature, expected) || match,
		false
	);
}

const customData = z.record(z.string(), z.unknown()).nullish();

const subscriptionData = z.looseObject({
	id: z.string().min(1),
	status: z.enum(['active', 'trialing', 'past_due', 'paused', 'canceled']),
	customer_id: z.string().nullish(),
	custom_data: customData,
	current_billing_period: z.looseObject({ starts_at: z.string(), ends_at: z.string() }).nullish(),
	canceled_at: z.string().nullish(),
	/** Cancel at period end: status stays `active` and this says when it stops. */
	scheduled_change: z.looseObject({ action: z.string(), effective_at: z.string() }).nullish()
});

const transactionData = z.looseObject({
	id: z.string().min(1),
	subscription_id: z.string().nullish(),
	customer_id: z.string().nullish(),
	custom_data: customData,
	currency_code: z.string(),
	billed_at: z.string().nullish(),
	details: z.looseObject({
		totals: z.looseObject({ grand_total: z.string().regex(/^\d+$/) })
	})
});

const envelope = z.looseObject({
	event_id: z.string().min(1),
	event_type: z.string().min(1),
	occurred_at: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
	data: z.unknown()
});

export type PaddleSubscription = z.infer<typeof subscriptionData>;
export type PaddleTransaction = z.infer<typeof transactionData>;

/** A verified webhook event; `kind` tells which `data` it carries (`other` events are ignored). */
export type PaddleEvent = { id: string; type: string; occurredAt: string } & (
	| { kind: 'subscription'; data: PaddleSubscription }
	| { kind: 'transaction'; data: PaddleTransaction }
	| { kind: 'other' }
);

/** The event in a webhook body, or null when its shape is not what Paddle documents. */
export function parsePaddleEvent(body: unknown): PaddleEvent | null {
	const event = envelope.safeParse(body);
	if (!event.success) {
		return null;
	}

	const base = {
		id: event.data.event_id,
		type: event.data.event_type,
		occurredAt: event.data.occurred_at
	};
	if (base.type.startsWith('subscription.')) {
		const data = subscriptionData.safeParse(event.data.data);
		return data.success ? { ...base, kind: 'subscription', data: data.data } : null;
	}

	if (base.type === 'transaction.completed') {
		const data = transactionData.safeParse(event.data.data);
		return data.success ? { ...base, kind: 'transaction', data: data.data } : null;
	}

	return { ...base, kind: 'other' };
}
