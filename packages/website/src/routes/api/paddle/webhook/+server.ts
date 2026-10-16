import { env } from '$env/dynamic/private';
import { errAsync, okAsync, ResultAsync } from 'neverthrow';
import { parsePaddleEvent, verifyPaddleSignature } from '$lib/server/clients/paddle';
import { badRequest, internal, unauthorized } from '$lib/server/errors';
import { handle } from '$lib/server/http';

/**
 * Paddle Billing notifications. No user auth: the `Paddle-Signature` is the only gate (401
 * when it fails). A signed event we cannot use (unknown type or account, unexpected shape)
 * answers 200 so Paddle stops retrying; a PocketBase failure answers 500 so it retries.
 */
export const POST = handle(({ request, locals }) =>
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
					.andThen(({ userId }) =>
						userId ? locals.services.rewards.markDirty([{ id: userId }]) : okAsync(undefined)
					)
					.map(() => ({ ok: true }))
					.orElse((error) => {
						console.error('[paddle] could not process webhook', event.type, event.id, error);
						return errAsync(internal('Could not process webhook'));
					});
			})
	)
);
