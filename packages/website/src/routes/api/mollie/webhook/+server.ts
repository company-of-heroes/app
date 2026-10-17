import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { badRequest, internal } from '$lib/server/errors';
import { handle } from '$lib/server/http';

/**
 * Mollie payment notifications. The body is only `id=tr_…` and unsigned: the service reads
 * the payment back from Mollie, so a forged call changes nothing. An id we cannot use answers
 * 200 so Mollie stops retrying; a Mollie or PocketBase failure answers 500 so it retries.
 * Labels and rewards are re-evaluated after the answer (Mollie times out after 15 s).
 */
export const POST = handle(({ request, locals, platform }) =>
	ResultAsync.fromPromise(request.text(), () => badRequest('Could not read body')).andThen(
		(body) => {
			const paymentId = new URLSearchParams(body).get('id') ?? '';
			return locals.services.subscriptions
				.handleWebhook(paymentId)
				.orElse((error) => {
					console.error('[mollie] could not process webhook', paymentId, error);
					return errAsync(internal('Could not process webhook'));
				})
				.andThen(({ userId }) => {
					if (!userId) {
						return okAsync({ ok: true });
					}

					// Labels and rewards follow at once; if that fails the job picks the user up.
					const evaluate = Promise.resolve(
						locals.services.rewards
							.evaluateNow(userId)
							.orElse((error) => {
								console.warn('[mollie] could not evaluate, queued', userId, error);
								return locals.services.rewards.markDirty([{ id: userId }]).map(() => 0);
							})
							.mapErr((error) => {
								console.error('[mollie] could not queue evaluation', userId, error);
								return error;
							})
					).then(() => undefined);
					const context = platform?.context;
					if (context) {
						context.waitUntil(evaluate);
						return okAsync({ ok: true });
					}

					// No platform (vite dev): finish before answering.
					return ResultAsync.fromSafePromise(evaluate).map(() => ({ ok: true }));
				});
		}
	)
);
