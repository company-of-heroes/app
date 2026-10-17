import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { z } from 'zod';
import { sendV1, type ApiDeps } from '../deps';
import { apiError, type ApiError } from '../errors';
import { fromPbPromise, requireAuth } from '../pb';
import { isMollieCheckoutUrl } from './checkout-url';
import type { SupporterCheckout, SupporterStatus, SupportersList } from './types';

const statusSchema = z.object({
	active: z.boolean(),
	status: z.string().nullable(),
	since: z.string().nullable(),
	months: z.number(),
	currentPeriodEnd: z.string().nullable(),
	endsAt: z.string().nullable(),
	hidden: z.boolean()
});

const checkoutSchema = z.object({
	checkoutUrl: z.string().refine(isMollieCheckoutUrl, 'Not a Mollie checkout link')
});

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

	/** The Mollie checkout link for the first payment. */
	checkout(): ResultAsync<SupporterCheckout, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return this.#call(checkoutSchema, '/subscriptions/checkout', 'Failed to start the checkout.', {
			method: 'POST'
		});
	}

	/** Stops the monthly payments; the medal stays until the paid period ends. */
	cancel(): ResultAsync<SupporterStatus, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return this.#call(statusSchema, '/subscriptions/cancel', 'Failed to cancel.', {
			method: 'POST'
		});
	}

	/** Undoes a cancel before the paid period ends. */
	resume(): ResultAsync<SupporterStatus, ApiError> {
		const auth = requireAuth(this.deps);
		if (auth.isErr()) {
			return errAsync(auth.error);
		}

		return this.#call(statusSchema, '/subscriptions/resume', 'Failed to resume.', {
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
