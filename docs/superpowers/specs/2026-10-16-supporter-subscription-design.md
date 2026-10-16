# Supporter subscription — design

Date: 2026-10-16

## Goal

Players asked for a way to support coh1stats. We add a €5/month **supporter subscription** (Paddle) that gives:

1. A **Supporter** badge (label), driven by new reward/label **conditions** staff can use.
2. **Exclusive supporter ribbons** to unlock through rewards.
3. A **medal next to the player's name** everywhere a name is shown.
4. A shareable **player card** (page + PNG).
5. A public **supporters page**.

Fair play, smurf detection, leaderboards, profiles and match history stay free. Nothing gameplay-relevant goes behind the subscription.

## Decisions

| Topic | Decision |
|---|---|
| Payment | Paddle Billing (merchant of record: EU VAT, invoices, customer portal), checkout + webhooks |
| Scope of status | Account property; shown on **every** verified Steam ID of the account |
| Conditions | `supporter_active` (boolean) and `supporter_months` (threshold), both account metrics |
| Cancelling | Medal and "active" labels disappear; earned ribbons/rewards stay |
| Status delivery | Via labels: system label **Supporter** with condition `supporter_active`; medal = that label present |
| Player card | Supporters only: `/card/[steamId]` page + server-rendered PNG (also `og:image`) |
| Supporters page | Listed by default, opt-out toggle; sections "Current supporters" and "Hall of fame" |

## 1. Data and payments

### PocketBase (schema-only migrations)

- `subscriptions` — one row per account: `user` (relation, unique), `paddleCustomerId`, `paddleSubscriptionId` (unique), `status` (`active` / `past_due` / `paused` / `canceled`), `currentPeriodEnd` (date), `canceledAt` (date), `created`/`updated`.
- `subscription_payments` — one row per paid Paddle transaction: `user`, `paddleTransactionId` (unique → webhook idempotency), `amount`, `currency`, `paidAt`.
- `users.supporterHidden` (bool, default false) — hide me from the supporters page.
- `user_labels.system` (bool) and `user_labels.key` (text, unique when set) — see section 2.
- No public list/view/create/update/delete rules on `subscriptions` / `subscription_payments`; only the website (superuser) reads and writes them.

### Meaning

- **Active** = `status ∈ {active, past_due}` and `currentPeriodEnd > now`. `past_due` counts so a single failed card retry does not drop the medal while Paddle retries.
- **Supporter months** = number of `subscription_payments` rows for the account.
- **Supporter since** = earliest `paidAt`.

### Website service `services/subscriptions.ts`

Class extending `Service`, neverthrow `.andThen` style.

- `POST /api/v1/subscriptions/checkout` (authenticated) → `{ priceId, customData: { userId }, customerEmail? }` for Paddle.js overlay checkout on the website.
- `POST /api/v1/subscriptions/portal` (authenticated) → Paddle customer portal session URL (cancel, change card).
- `GET /api/v1/subscriptions/me` (authenticated) → `{ active, status, since, months, currentPeriodEnd, hidden }`.
- `POST /api/paddle/webhook` — verifies `Paddle-Signature` (`ts=…;h1=…`, HMAC-SHA256 of `ts:rawBody` with `PADDLE_WEBHOOK_SECRET`, reject when `ts` is older than 5 minutes).
  - `subscription.created|updated|canceled|paused|resumed|past_due|activated` → upsert `subscriptions` by `paddleSubscriptionId`; `user` from `custom_data.userId` (ignored when the user does not exist).
  - `transaction.completed` with a `subscription_id` → insert `subscription_payments` (duplicate transaction id = no-op).
  - Afterwards: evaluate labels and rewards for that account immediately (same code path the `rewards-evaluate` job uses, scoped to one user).
  - Always answers 200 on a valid signature, also for ignored events; 401 on a bad signature.
- Desktop app: the "Become a supporter" / "Manage" buttons open `https://coh1stats.com/supporters?checkout=1` (or the portal) in the browser via the opener plugin. No Paddle in Tauri.

### Safety net

Jobs worker gets an hourly `subscriptions-expire` job (`POST /api/internal/jobs/subscriptions-expire`): re-evaluates live labels for accounts whose `currentPeriodEnd` passed, in case a webhook was missed.

### Config

`PADDLE_ENV` (`sandbox` | `production`), `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PUBLIC_PADDLE_CLIENT_TOKEN`, `PUBLIC_PADDLE_PRICE_ID`. Added to `wrangler.toml` vars/secrets docs and `.env.example`.

### Privacy

`POLICY.md`: Paddle as payment processor and merchant of record; we store only Paddle ids, subscription status and payment dates/amounts, never card data; supporter status, months and "since" are public (medal, supporters page, player card) unless the user hides themselves from the supporters page (the medal stays visible). New effective date.

## 2. Conditions, Supporter label, medal

### Metrics

In `packages/ui/src/reward/metrics.ts` (`REWARD_METRICS`, `REWARD_METRIC_CATALOG`) and validated by `packages/api/src/rewards/schema.ts`:

- `supporter_active` — "Supporter (active)", `boolean: true`, no filters.
- `supporter_months` — "Supporter months", `unit: 'Months'`, no filters.

Both are account metrics (not in `REWARD_STEAM_METRICS`). The admin condition editor picks them up for rewards and labels. `services/rewards.ts` computes them per account from `subscriptions` / `subscription_payments`.

### Live labels (`services/label-auto.ts`)

A label whose conditions include `supporter_active` is **live**: on every evaluation, assignments of live labels whose conditions no longer hold are removed. Normal labels and all rewards keep the current never-take-back rule. Staff revocations (`player_label_revocations`) still win for live labels.

### System label "Supporter"

Migration creates the label (if no `key = 'supporter'` exists): name "Supporter", gold colour, tooltip, `conditions = [{ metric: 'supporter_active', threshold: 1 }]`, `system = true`, `key = 'supporter'`.

Admin labels tab: system labels cannot be deleted, their conditions are read-only and they cannot be assigned by hand; name, colour and tooltip stay editable. Staff can create extra labels with the new metrics (e.g. "Veteran supporter", `supporter_months ≥ 12`).

`packages/ui/src/format/labels.ts`: `SUPPORTER_LABEL_KEY = 'supporter'`, `isSupporter(labels)` matches on `key`. `PlayerLabel` type gains `key?: string | null`; label queries in `packages/api/src/labels/labels.ts` return it.

### Medal

- Asset: `shared-assets/medals/supporter.svg`, generated by a supporter variant in `scripts/generate-medals.mjs` (gold + enamel, same drawing style as tournament medals).
- `packages/ui/src/player/player-supporter-medal.svelte` — small medal with tooltip "Supporter" (`aria-label`), same props shape as `PlayerStreamerIcon` (`labels`, `steamId`, `size`, `class`), labels loaded through `host.api.labels.forSteamId` when not passed.
- `packages/ui/src/player/player-name-icons.svelte` — renders supporter medal + streamer icon; replaces every `PlayerStreamerIcon` usage (ui: comments, leaderboard-player, live-lobby-players, team-player-list, player-byline, player-match-history, player-profile-header, player-search-card, smurf-alert, replay-detail, replay-overview; app: match-screenshots, player-alias, widget-dashboard-hero, widget-profile, admin flagged-tab). `PlayerStreamerIcon` stays as the inner piece.
- Profile header and player card show the medal larger.

## 3. Ribbons, player card, supporters page

### Ribbons (`shared-assets/scripts/generate-ribbons.mjs`)

New supporter palette (gold, burgundy, cream), appended after the existing 401 (`ribbon-402…`), `raceId: null`, in `ribbons.json`:

- Series `supporter`, levels 1–5 (1–5 devices) — intended for 1, 3, 6, 12, 24 months.
- "Founding Supporter".
- Two neutral supporter ribbons for staff to attach to their own rewards.

Existing ribbons keep their files and keys (generator stays seeded; the new ones are generated after the existing loop).

### Rewards (`pocketbase/scripts/seed-rewards.mjs`)

Seed: five "Supporter — N months" rewards (`supporter_months ≥ 1/3/6/12/24`, series ribbons) and "Founding Supporter" (`supporter_months ≥ 1`). Staff archives Founding Supporter after the launch period; holders keep it.

### Player card

- `GET /api/v1/players/{steamId}/card.png` — server-rendered with **satori + @resvg/resvg-wasm** (both run on Workers), 1200×630; avatar, name + medal + labels, best ELO and rank per faction, win rate, matches, latest 5 ribbons. `cache-control: public, max-age=3600`. 404 when the Steam ID is not an active supporter.
- `/card/[steamId]` (+ `/es`, `/ko`) — the current redirect becomes a card page for active supporters (same content as the PNG, as HTML) with "Download PNG"; `og:image` = the PNG. Non-supporters keep the redirect to the profile.
- Existing JSON `GET /api/v1/players/{id}/card` and the gateway rule for `/api/player-card/:steamId` stay unchanged.
- Own profile of a supporter (app + website): "Player card" button (host link).

### Supporters page

- Website `/supporters` (+ `/es`, `/ko`), linked from the footer and from the app (opens in browser).
- Top: what you get (medal, ribbons, player card, name on this page), €5/month, "Become a supporter" (Paddle overlay; requires login, otherwise login first and return). Logged-in supporters see "Manage subscription" (portal).
- "Current supporters": medal, name (main Steam ID, linked to profile), months; sorted by months desc.
- "Hall of fame": former supporters with their months.
- Hidden users (`supporterHidden`) appear in neither list.
- Data: `GET /api/v1/supporters` (public, `max-age=300`) → `{ current: [...], former: [...] }` with `steamId, alias, avatarUrl, months, since`.
- Shared list UI in `packages/ui/src/supporter/`; flush-border rules apply.

### Account page (app + website)

Supporter section: status, since, months, next payment date, "Manage subscription" (portal), "Hide me from the supporters page" toggle (`PATCH /api/v1/subscriptions/me { hidden }`). Not a supporter: short pitch + "Become a supporter".

### API package

`packages/api/src/subscriptions/` — `me()`, `checkout()`, `portal()`, `setHidden()`, `supporters()` via `sendV1`; zod schemas; exported from `index.ts`.

### i18n

All new strings in `en`, `es`, `ko`.

### Changeset

One `minor` changeset for `@company-of-heroes/app`, `website`, `ui`, `api`, `i18n`, `pocketbase`, `shared-assets`, `jobs-worker`:
`feat; supporter subscription with medal, supporter ribbons, player card and supporters page`

## Error handling

- Webhook: bad signature 401; unknown user / unknown event → 200 + log; PocketBase failure → 500 so Paddle retries.
- Checkout/portal without login → 401; portal without a subscription → 404.
- Card PNG render failure → 500, page falls back to HTML card without `og:image`.
- Supporter status missing (no row) = not a supporter everywhere.

## Verification

No new automated tests (project rule). Verify by hand against the Paddle sandbox: subscribe → medal appears on all linked Steam IDs within seconds and on the supporters page; 1-month reward + ribbon unlocks; card page and PNG render; cancel at period end → medal and Supporter label gone after `currentPeriodEnd`, ribbons stay; replayed webhook does not double-count months; `svelte-autofixer` on every edited `.svelte` file; `pnpm check` and `pnpm check:duplicates` clean.

## Out of scope

Other tiers or yearly price, TTS/analytics perks, gifting, consecutive-months ("anniversary") tracking, in-app (Tauri) checkout.
