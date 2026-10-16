import { env } from '$env/dynamic/private';
import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { parsePaddleEvent, verifyPaddleSignature } from '$lib/server/clients/paddle';
import { badRequest, internal, unauthorized } from '$lib/server/errors';
import { handle } from '$lib/server/http';

/**
 * Paddle Billing notifications. No user auth: the `Paddle-Signature` is the only gate (401
 * when it fails). A signed event we cannot use (unknown type or account, unexpected shape)
 * answers 200 so Paddle stops retrying; a PocketBase failure answers 500 so it retries.
 * Labels and rewards are re-evaluated after the answer (Paddle times out after ~5 s).
 */
export const POST = handle(({ request, locals, platform }) =>
	ResultAsync.fromPromise(request.text(), () => badRequest('Could not read body')).andThen(
		(rawBody) =>
			ResultAsync.fromSafePromise(
				verifyPaddleSignature(
					request.headers.get('paddle-signature'),
					rawBody,
					env.PADDLE_WEBHOOK_SECRET ?? ''
				)
			).andThen((valid) => {
				if (!valid) {
					console.warn('[paddle] rejected webhook with a bad signature');
					return errAsync(unauthorized('Invalid signature'));
				}

				let body: unknown;
				try {
					body = JSON.parse(rawBody);
				} catch {
					body = null;
				}

				const event = parsePaddleEvent(body);
				if (!event) {
					const fields = (body ?? {}) as { event_type?: unknown; event_id?: unknown };
					console.warn(
						'[paddle] ignored signed webhook with an unexpected payload',
						fields.event_type,
						fields.event_id
					);
					return okAsync({ ok: true });
				}

				return locals.services.subscriptions
					.handleWebhook(event)
					.orElse((error) => {
						console.error('[paddle] could not process webhook', event.type, event.id, error);
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
									console.warn('[paddle] could not evaluate, queued', userId, error);
									return locals.services.rewards.markDirty([{ id: userId }]).map(() => 0);
								})
								.mapErr((error) => {
									console.error('[paddle] could not queue evaluation', userId, error);
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
			})
	)
);
