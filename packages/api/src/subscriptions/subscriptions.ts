import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { z } from 'zod';
import { sendV1, type ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import { fromPbPromise, requireAuth } from '../pb';
import type { SupporterCheckout, SupporterStatus, SupportersList } from './types';

const statusSchema = z.object({
	active: z.boolean(),
	status: z.string().nullable(),
	since: z.string().nullable(),
	months: z.number(),
	currentPeriodEnd: z.string().nullable(),
	hidden: z.boolean()
});

const checkoutSchema = z.object({
	priceId: z.string(),
	clientToken: z.string(),
	environment: z.enum(['sandbox', 'production']),
	customData: z.object({ userId: z.string() }),
	email: z.string().nullable()
});

const portalSchema = z.object({ url: z.string() });

const entrySchema = z.object({
	steamId: z.string(),
	alias: z.string(),
	avatarUrl: z.string().nullable(),
	months: z.number(),
	since: z.string()
});

const supportersSchema = z.object({
	current: z.array(entrySchema),
	former: z.array(entrySchema)
});

export class SubscriptionsApi {
	constructor(private deps: ApiDeps) {}

	/** Calls a v1 route and checks the shape of its answer. */
	#call<T>(
		schema: z.ZodType<T>,
		path: string,
		fallback: string,
		options?: { method?: string; body?: Record<string, unknown> }
	): ResultAsync<T, ApiError> {
		return fromPbPromise(sendV1<unknown>(this.deps, path, options), fallback).andThen((data) => {
			const parsed = schema.safeParse(data);
			return parsed.success ? okAsync(parsed.data) : errAsync(apiError(502, fallback));
		});
	}

	/** The signed-in user's supporter status. */
	me(): ResultAsync<SupporterStatus, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return this.#call(statusSchema, '/subscriptions/me', 'Failed to load your supporter status.');
	}

	/** What Paddle.js needs to open the checkout. */
	checkout(): ResultAsync<SupporterCheckout, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return this.#call(checkoutSchema, '/subscriptions/checkout', 'Failed to start the checkout.', {
			method: 'POST'
		});
	}

	/** Paddle customer portal link (cancel, change card). */
	portal(): ResultAsync<{ url: string }, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return this.#call(portalSchema, '/subscriptions/portal', 'Failed to open the portal.', {
			method: 'POST'
		});
	}

	/** Shows or hides the user on the supporters page. */
	setHidden(hidden: boolean): ResultAsync<SupporterStatus, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return this.#call(statusSchema, '/subscriptions/me', 'Failed to save.', {
			method: 'PATCH',
			body: { hidden }
		});
	}

	/** The public supporters page. */
	supporters(): ResultAsync<SupportersList, ApiError> {
		return this.#call(supportersSchema, '/supporters', 'Failed to load supporters.');
	}
}
