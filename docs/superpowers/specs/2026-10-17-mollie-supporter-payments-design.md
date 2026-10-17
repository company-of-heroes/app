# Supporter subscription: Paddle → Mollie

Date: 2026-10-17. Replaces the payment side of `2026-10-16-supporter-subscription-design.md`; everything else in that spec (medal, live labels, ribbons, player card, supporters page, one row per account) stays.

## Goal

Remove Paddle completely and take the €4.99/month supporter subscription through Mollie (iDEAL, credit card, PayPal; methods are enabled in the Mollie dashboard, not restricted in code). Nothing is released yet (`loyal-supporters` changeset is pending), so there are no Paddle subscribers to migrate.

Not a goal: chargeback handling, invoices (Mollie sends none; the operator handles them), changing the payment method.

## Approach

Mollie Subscriptions API: a first payment (`sequenceType: first`) creates a mandate; on success we create a Mollie subscription that charges €4.99 every month on that mandate. Mollie is a payment processor, not merchant of record: the operator is the seller.

## Flows

### Checkout

`checkout(userId)`:

1. 409 when the account is already active (`isActive`).
2. Reuse `mollieCustomerId` from the account's row, else create a Mollie customer (`name` = user id, `email` only when it is not the `@fknoobs.com` placeholder, `metadata.userId`).
3. Create a payment: `amount { currency: 'EUR', value: '4.99' }`, `sequenceType: 'first'`, `customerId`, `description: 'coh1stats supporter'`, `redirectUrl` = `/supporters?welcome=1` (locale-aware, absolute), `webhookUrl` = `${MOLLIE_WEBHOOK_ORIGIN}/api/mollie/webhook` (omitted when unset), `metadata { userId }`.
4. Return `{ checkoutUrl }` (`_links.checkout.href`). Client does `window.location.assign`. `packages/api` and the remote command accept it only when the host is `mollie.com` or a subdomain (`isMollieCheckoutUrl`).

`userId` comes from the session on the server, so a checkout cannot target someone else's account.

### Webhook `POST /api/mollie/webhook`

Body `id=tr_…` (form-encoded). No signature: the payment is fetched from the Mollie API with `MOLLIE_API_KEY`; that fetch is the verification. Answers:

- 200 for an unknown id, a non-`tr_` id, or a payment we ignore (Mollie stops retrying);
- 500 when Mollie or PocketBase fails (Mollie retries);
- after a 200 with a `userId`, rewards are re-evaluated in `waitUntil` (same as the Paddle route).

State-based: every delivery re-reads the payment (and subscription), so order and duplicates do not matter.

**First payment** (`sequenceType: first`, no `subscriptionId`):

- `paid`: owner = `metadata.userId` (must be an existing user).
  - If the account's row is paying and not cancelled (`isActive` and no `cancelAt`), do not create a subscription (double checkout in two tabs); the payment still counts as a month.
  - Else create a Mollie subscription: `amount 4.99 EUR`, `interval: '1 month'`, `startDate` = paid date + 1 month (YYYY-MM-DD), `mandateId` = payment's `mandateId`, `webhookUrl`, `description: 'coh1stats supporter'`, `metadata { userId }`. Upsert the row: `mollieCustomerId`, `mollieSubscriptionId`, `mollieMandateId`, `status: active`, `currentPeriodEnd` = `startDate` + 7 days grace, `cancelAt: ''`, `canceledAt: ''`. If the row create hits the unique user index (parallel delivery), cancel the just-created Mollie subscription and re-read.
  - Record the payment.
- Other statuses: ignored.

**Recurring payment** (has `subscriptionId`): owner = row with that `mollieSubscriptionId`; none → ignored.

- `paid`: record the payment; fetch the subscription; `status: active`, `currentPeriodEnd` = `nextPaymentDate` + 7 days (unchanged if the row is cancelled: `cancelAt` keeps it).
- `failed` / `expired` / `canceled`: `status: past_due`. The medal stays until `currentPeriodEnd`; the hourly `expire` job then removes it.
- `open` / `pending` / `authorized`: ignored (SEPA direct debit sits in `pending` for days; the 7-day grace covers it).

**Record the payment**: `subscription_payments` row `{ user, molliePaymentId, amount (cents), currency, paidAt }`; the unique `molliePaymentId` makes a redelivery a no-op.

### Cancel

`cancel(userId)`: 404 without a row, 409 when not active or already cancelled. `DELETE` the Mollie subscription (a 404/410 from Mollie counts as done). Row: `cancelAt` = paid-through date (`currentPeriodEnd` minus the grace, i.e. the next payment date), `currentPeriodEnd` = `cancelAt`, `canceledAt` = now; `status` stays `active`. Medal stays until `cancelAt`.

### Resume

`resume(userId)`: only when the row is active and has `cancelAt` in the future. Fetch the mandate; not `valid` → 409 "start a new checkout". Create a Mollie subscription on `mollieMandateId` with `startDate` = `cancelAt` date. Row: new `mollieSubscriptionId`, `cancelAt: ''`, `canceledAt: ''`, `currentPeriodEnd` = `startDate` + 7 days.

After the period ends, or from `past_due`, a new checkout is allowed (not active).

### Status

`SupporterStatus` keeps its shape. `endsAt` = `cancelAt` (shown with a Resume button); `status` values: `active`, `past_due`, `canceled`.

## Data

New migration `1791000069_mollie_subscriptions.js` (schema only; the local DB already ran 066):

- `subscriptions`: rename `paddleCustomerId` → `mollieCustomerId`, `paddleSubscriptionId` → `mollieSubscriptionId` (stays required + unique index, renamed `idx_subscriptions_mollie_subscription`); add text `mollieMandateId`; remove `paddleUpdatedAt`; `status` values `active`, `past_due`, `canceled`.
- `subscription_payments`: rename `paddleTransactionId` → `molliePaymentId` (unique index renamed `idx_subscription_payments_payment`).

App `pocketbase/types.ts` follows.

## Code

- `packages/website/src/lib/server/clients/mollie.ts`: `MollieClient(fetch, apiKey)` with `createCustomer`, `createPayment`, `getPayment`, `createSubscription`, `getSubscription`, `cancelSubscription`, `getMandate`; zod schemas; `fetchJson`/`Task` like the other clients. Delete `clients/paddle.ts` and `$lib/paddle.ts`.
- `services/index.ts`: `clients.mollie` instead of `clients.paddle`.
- `services/subscriptions.ts`: `checkout`, `cancel`, `resume`, `handleWebhook(paymentId)`; the anti-hijack/ordering code tied to Paddle events goes.
- Routes: delete `api/paddle/webhook`, add `api/mollie/webhook`; `api/v1/subscriptions/checkout` returns `{ checkoutUrl }`; `api/v1/subscriptions/portal` → `cancel` and `resume` (POST).
- `subscriptions.remote.ts`: `startSupporterCheckout`, `cancelSupporter`, `resumeSupporter` (no portal).
- `packages/api`: `checkout()` → `{ checkoutUrl }`, `cancel()`, `resume()`; `isPaddlePortalUrl` → `isMollieCheckoutUrl`.
- `packages/ui` supporter components: `onmanage` → `oncancel` / `onresume`; Cancel is a destructive button behind the shared confirm dialog (`danger: true`); Resume shows while `endsAt` is set.
- `packages/app`: header-supporter and account page call `api.subscriptions.cancel()` / `resume()`; drop the `*.paddle.com` opener capability.
- Env: `MOLLIE_API_KEY` (Worker secret; `test_…` = test mode), `MOLLIE_WEBHOOK_ORIGIN` (`[vars]`, `https://coh1stats.com`; in dev a tunnel URL, or empty to skip the webhook). Remove all `PADDLE_*`.
- Docs: `POLICY.md` (Mollie as payment processor, not merchant of record; stored Mollie customer/subscription/mandate/payment IDs; email passed to Mollie only when real), `packages/website/DEPLOY.md`, `wrangler.toml`. No new changeset (`loyal-supporters.md` does not mention Paddle).

## Errors

Mollie API errors map to `upstream` (502). Missing `MOLLIE_API_KEY` → checkout answers "Supporter checkout is not configured". Webhook logs with a `[mollie]` prefix.

## Verification

No new tests (project rule). `pnpm check` for website/ui/api/app, svelte-autofixer on every edited `.svelte`, and a Mollie test-mode run through a tunnel: checkout → paid → medal; cancel → `endsAt` shown; resume; a failed test payment → `past_due`.
