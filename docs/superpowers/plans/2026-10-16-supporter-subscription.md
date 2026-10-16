# Supporter Subscription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** €5/month Paddle supporter subscription that drives a Supporter label + medal next to names, supporter conditions and ribbons, a player card and a supporters page.

**Architecture:** PocketBase stores a mirror of Paddle (`subscriptions`, `subscription_payments`), written only by a website service from signed webhooks. Two new account metrics (`supporter_active`, `supporter_months`) plug into the existing reward/label condition engine; labels with `supporter_active` are "live" and get revoked. The medal is the system label `key = 'supporter'`, rendered by a shared `PlayerNameIcons` wherever `PlayerStreamerIcon` is used today.

**Tech Stack:** PocketBase JS migrations, SvelteKit (website on Cloudflare Workers, app on Tauri), Svelte 5 runes, neverthrow + zod, Paddle Billing (REST + Paddle.js v2), satori + @resvg/resvg-wasm.

**Spec:** `docs/superpowers/specs/2026-10-16-supporter-subscription-design.md`

## Global Constraints

- No new tests (`.claude/rules/cursor/no-tests.md`); verification = `pnpm check`, `pnpm check:duplicates`, `svelte-autofixer` on every edited `.svelte`/`.svelte.ts`, and manual checks against the Paddle sandbox.
- Migrations are schema-only and fast; next free number is `1791000066`.
- Website services are classes extending `Service`, registered in `packages/website/src/lib/server/services/index.ts`, neverthrow `.andThen` style (no `safeTry`).
- UI components live once in `packages/ui`; host differences go through `useHost()` ports implemented in `packages/app/src/lib/host.ts` and `packages/website/src/lib/host.ts`.
- Active = `status ∈ {active, past_due}` and `currentPeriodEnd > now`. Months = count of `subscription_payments` rows. Since = earliest `paidAt`.
- Cancelling: live labels (medal) removed; rewards/ribbons never taken back.
- Env: `PADDLE_ENV` (`sandbox`|`production`), `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PUBLIC_PADDLE_CLIENT_TOKEN`, `PUBLIC_PADDLE_PRICE_ID`.
- Price copy: "€5 / month". Supporter label: name "Supporter", key `supporter`.
- Every user-facing string in `packages/i18n/locales/{en,es,ko}.json`.
- Shared UI follows flush-borders, interactive-cursor, uniform-badges and blank-lines rules.
- Commit only the files of the task (`git add <paths>`); the working tree has unrelated uncommitted work.

## Review Focus

1. **Webhook delivered twice or out of order** (Paddle retries; `subscription.updated` before `created`): months must not double, and an older event must not overwrite a newer status. → Task 3 upserts by `paddleSubscriptionId` and skips an event whose `occurred_at` is older than the stored `paddleUpdatedAt`; payments insert on unique `paddleTransactionId`.
2. **Account links a second Steam ID while subscribed, or unlinks one**: the new ID should get the medal; an unlinked ID should lose it. → Task 4 evaluates on link (existing `markDirty`) and the expire job also removes live-label assignments on Steam IDs no longer linked to a supporter.
3. **Steam ID shared by two accounts** (one supporter): the medal must not appear through the other account. → Task 4 keeps the `owner.shared` exclusion for live labels.
4. **Webhook for a user that no longer exists / missing `custom_data.userId`** (subscription made outside our checkout): must not 500-loop. → Task 3 answers 200 and logs.
5. **Card PNG for a player with no ranked stats or no avatar**: must still render. → Task 9 renders "Unranked" and a placeholder avatar.

---

### Task 1: PocketBase schema

**Files:**
- Create: `packages/pocketbase/pb_migrations/1791000066_subscriptions.js`
- Create: `packages/pocketbase/pb_migrations/1791000067_supporter_label.js`
- Modify: `packages/app/src/lib/core/pocketbase/types.ts` (typegen output or hand-add the new collections/fields like neighbours)

**Interfaces:**
- Produces: collections `subscriptions { user (relation users, unique), paddleCustomerId, paddleSubscriptionId (unique), status (select: active|past_due|paused|canceled), currentPeriodEnd (date), canceledAt (date), paddleUpdatedAt (date), created, updated }`, `subscription_payments { user (relation users), paddleTransactionId (unique), amount (number, cents), currency (text), paidAt (date) }` — all rules `null` (superuser only). `users.supporterHidden` (bool). `user_labels.system` (bool), `user_labels.key` (text, unique index where `key != ''`).
- Migration 0067 inserts the label `{ name: 'Supporter', key: 'supporter', system: true, color: '#E0B23A', tooltip: 'Supports coh1stats', conditions: [{ metric: 'supporter_active', threshold: 1 }] }` only when no row with `key = 'supporter'` exists. Down removes fields/collections and that row.

- [ ] **Step 1:** Write both migrations following `1791000059_user_labels_conditions.js` (guard every add with `getByName`).
- [ ] **Step 2:** Start local PocketBase (`pnpm --filter @company-of-heroes/pocketbase dev`). Expected: `Server started` without delay; collections visible in the admin UI; Supporter label present.
- [ ] **Step 3:** Update PocketBase types; run `pnpm --filter @company-of-heroes/app check`. Expected: 0 errors.
- [ ] **Step 4:** Commit `feat(pocketbase): subscriptions schema and supporter label`.

### Task 2: Metrics, label key, schema

**Files:**
- Modify: `packages/ui/src/reward/metrics.ts` (`REWARD_METRICS`, `REWARD_METRIC_CATALOG`)
- Modify: `packages/ui/src/format/types.ts` (`PlayerLabel.key?: string | null`, `system?: boolean`)
- Modify: `packages/ui/src/format/labels.ts`
- Modify: `packages/api/src/labels/labels.ts` (`UserLabel` gets `key`, `system`; queries already expand the whole label — check `fields` lists include them)

**Interfaces:**
- Produces: metrics `'supporter_active'` (`{ label: 'Supporter (active)', filters: [], boolean: true }`) and `'supporter_months'` (`{ label: 'Supporter months', filters: [], unit: 'Months' }`), both account metrics (not in `REWARD_STEAM_METRICS`).
- Produces in `format/labels.ts`: `SUPPORTER_LABEL_KEY = 'supporter'`, `SUPPORTER_METRICS: readonly RewardMetric[] = ['supporter_active', 'supporter_months']`, `isSupporter(labels: PlayerLabel[] | null | undefined): boolean` (matches `label.key === SUPPORTER_LABEL_KEY`), `isLiveLabel(conditions: readonly Pick<RewardCondition,'metric'>[]): boolean` (true when any condition is `supporter_active`).

- [ ] **Step 1:** Implement the above; `rewardConditionSchema` in `packages/api/src/rewards/schema.ts` needs no change (it reads the catalog) — confirm the boolean refine accepts `supporter_active` with threshold 1.
- [ ] **Step 2:** `pnpm --filter @company-of-heroes/ui check && pnpm --filter @company-of-heroes/api check` (or `tsc` for api). Expected: the `switch` in website `rewards.ts` now errors on non-exhaustive metrics only if it uses `never` — note it for Task 4.
- [ ] **Step 3:** Commit `feat(ui): supporter reward metrics and label key`.

### Task 3: Subscriptions service + Paddle webhook

**Files:**
- Create: `packages/website/src/lib/server/clients/paddle.ts`
- Create: `packages/website/src/lib/server/services/subscriptions.ts`
- Modify: `packages/website/src/lib/server/services/index.ts` (register `subscriptions`)
- Create: `packages/website/src/routes/api/paddle/webhook/+server.ts`
- Modify: `packages/website/wrangler.toml` (vars `PADDLE_ENV`, `PUBLIC_PADDLE_CLIENT_TOKEN`, `PUBLIC_PADDLE_PRICE_ID`; comment listing secrets `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`), local `.env` example values for sandbox

**Interfaces:**
- `PaddleClient` (constructor `(fetch, apiKey, env)`; base `https://sandbox-api.paddle.com` or `https://api.paddle.com`):
  - `portalUrl(customerId: string, subscriptionId: string): Task<string>` → `POST /customers/{id}/portal-sessions` with `subscription_ids`, returns `data.urls.general.overview`.
- `verifyPaddleSignature(header: string | null, rawBody: string, secret: string, now = Date.now()): Promise<boolean>` (exported from `paddle.ts`): parse `ts=…;h1=…`, reject `|now/1000 - ts| > 300`, HMAC-SHA256 (`crypto.subtle`) of `` `${ts}:${rawBody}` ``, constant-time compare to `h1`.
- `SubscriptionsService`:
  - `type SupporterStatus = { active: boolean; status: string | null; since: string | null; months: number; currentPeriodEnd: string | null; hidden: boolean }`
  - `status(userId: string): Task<SupporterStatus>`
  - `isActive(userId: string): Task<boolean>`, `months(userId: string): Task<number>` (used by rewards metrics)
  - `handleWebhook(event: PaddleEvent): Task<{ userId: string | null }>`:
    - `subscription.*` → upsert by `paddleSubscriptionId`; fields from `data.status`, `data.current_billing_period.ends_at`, `data.canceled_at`, `data.customer_id`, `user` from `data.custom_data.userId`; skip when `occurred_at <= paddleUpdatedAt`. Paddle `trialing` maps to `active`.
    - `transaction.completed` with `data.subscription_id` → create payment (`amount = Number(data.details.totals.grand_total)`, `currency = data.currency_code`, `paidAt = data.billed_at`); unique collision = no-op.
    - Unknown event or no resolvable user → `{ userId: null }` + `console.warn`.
- Webhook route: read raw text, verify (401 on failure), `JSON.parse`, `handleWebhook`, then `services.rewards.evaluateNow(userId)` (Task 4) when `userId`; PocketBase failure → 500; otherwise 200 `{ ok: true }`.

- [ ] **Step 1:** Implement `paddle.ts` and `subscriptions.ts`; register the service.
- [ ] **Step 2:** Implement the webhook route (until Task 4 lands, call `services.rewards.markDirty([{ id: userId }])`).
- [ ] **Step 3:** `pnpm --filter @company-of-heroes/website check`. Expected: 0 errors.
- [ ] **Step 4:** In the Paddle sandbox dashboard, create a €5 monthly price and a notification destination pointing at a tunnel to local dev (`cloudflared tunnel --url http://localhost:5173`); use "Send test event" for `subscription.created` and `transaction.completed`. Expected: rows in both collections; resending the same transaction leaves one payment row; a tampered body gets 401.
- [ ] **Step 5:** Commit `feat(website): paddle webhook and subscriptions service`.

### Task 4: Supporter metrics in the evaluator, live labels, expire job

**Files:**
- Modify: `packages/website/src/lib/server/services/rewards.ts` (metric switch ~line 724, `shownOn` line 178, `evaluateLabels` line 1013, new public `evaluateNow`)
- Modify: `packages/website/src/lib/server/services/label-auto.ts` (new `removeFrom`, `removeLiveExcept`)
- Modify: `packages/website/src/routes/api/internal/jobs/[name]/+server.ts` (job `subscriptions-expire`)
- Modify: `packages/jobs-worker/src/index.ts` (`{ name: 'subscriptions-expire', every: 60, offset: 7 }`)
- Modify: `packages/website/src/routes/api/paddle/webhook/+server.ts` (use `evaluateNow`)

**Interfaces:**
- Consumes: `SubscriptionsService.isActive/months` (Task 3), `isLiveLabel`, `SUPPORTER_METRICS` (Task 2).
- Produces:
  - Metric cases: `supporter_active` → `subscriptions.isActive(owner.id)` as 0/1; `supporter_months` → `subscriptions.months(owner.id)`.
  - `shownOn`: conditions using only account metrics where at least one is in `SUPPORTER_METRICS` and the metric set is labels (not rewards) → shown on every non-shared Steam ID. Implement as a separate `labelShownOn(owner, steamId)` used by `evaluateLabels`; rewards keep `shownOn` (supporter ribbons stay on the main Steam ID, as all account rewards).
  - `evaluateLabels`: for live labels, also evaluate labels already in `have`; when progress `< 1`, collect for removal → `labelAuto.removeFrom(steamId, labelIds): Task<number>` (deletes `player_label_assignments` rows, `uncache` the label cache key used by `forSteamId`). Non-live labels unchanged (never taken back). Staff revocation still blocks granting.
  - `RewardsService.evaluateNow(userId: string): Task<number>` — loads the catalog and calls the private `evaluate(userId, catalog)`, then `setCheckedAt`.
  - `SubscriptionsService.expire(): Task<{ processed: number; more: boolean }>` — users with `status ∈ {active,past_due}` and `currentPeriodEnd < now` (≤ 50 per run) → `evaluateNow` each; plus `labelAuto.removeLiveExcept(steamIds)` removing live-label assignments whose Steam ID is not linked to an active supporter (Review Focus 2).

- [ ] **Step 1:** Implement the metric cases and `labelShownOn`.
- [ ] **Step 2:** Implement live-label revocation (`removeFrom`) in `evaluateLabels`; update the class doc comment ("never taken back, except live supporter labels").
- [ ] **Step 3:** Implement `evaluateNow`, switch the webhook to it, add `expire` + `removeLiveExcept`, register job + worker entry.
- [ ] **Step 4:** `pnpm --filter @company-of-heroes/website check && pnpm --filter @company-of-heroes/jobs-worker check`. Expected: 0 errors.
- [ ] **Step 5:** Manual (sandbox): subscribe a test account with two linked Steam IDs → within seconds both have the Supporter label; send `subscription.canceled` with `current_billing_period.ends_at` in the past, run `curl -X POST -H "authorization: Bearer $SERVICE_TOKEN" localhost:5173/api/internal/jobs/subscriptions-expire` → label gone on both; a `supporter_months ≥ 1` reward stays unlocked.
- [ ] **Step 6:** Commit `feat(website): supporter conditions and live labels`.

### Task 5: Supporter API endpoints + api client

**Files:**
- Create: `packages/website/src/routes/api/v1/subscriptions/checkout/+server.ts` (POST)
- Create: `packages/website/src/routes/api/v1/subscriptions/portal/+server.ts` (POST)
- Create: `packages/website/src/routes/api/v1/subscriptions/me/+server.ts` (GET, PATCH `{ hidden: boolean }`)
- Create: `packages/website/src/routes/api/v1/supporters/+server.ts` (GET, `cache-control: public, max-age=300`)
- Modify: `packages/website/src/lib/server/services/subscriptions.ts` (`checkout`, `portal`, `setHidden`, `list`)
- Create: `packages/api/src/subscriptions/{index,subscriptions,types}.ts`; Modify: `packages/api/src/index.ts`

**Interfaces:**
- `checkout(userId) → { priceId: string; clientToken: string; environment: 'sandbox'|'production'; customData: { userId: string }; email: string | null }` (email omitted when it ends in `@fknoobs.com`).
- `portal(userId) → { url: string }`; 404 when no subscription row.
- `setHidden(userId, hidden) → SupporterStatus`.
- `list() → SupportersList = { current: SupporterEntry[]; former: SupporterEntry[] }`, `SupporterEntry = { steamId: string; alias: string; avatarUrl: string | null; months: number; since: string }`; main Steam ID of each account, hidden users excluded, `current` sorted by months desc then since asc, `former` = accounts with payments and not active.
- `packages/api` client: `api.subscriptions.me()`, `.checkout()`, `.portal()`, `.setHidden(hidden)`, `.supporters()` — all via `sendV1`, zod-parsed, `requireAuth` except `supporters()`. Types `SupporterStatus`, `SupportersList`, `SupporterEntry` exported (put the types in `packages/ui/src/supporter/types.ts` so ui can use them; api re-imports them like rewards does).

- [ ] **Step 1:** Implement service methods and routes (auth via the same helper existing `api/v1/rewards/me` uses).
- [ ] **Step 2:** Implement the api client module and export it.
- [ ] **Step 3:** `pnpm check`. Expected: 0 errors. `curl localhost:5173/api/v1/supporters` → JSON with the sandbox account in `current`.
- [ ] **Step 4:** Commit `feat(api): supporter endpoints`.

### Task 6: Medal asset, PlayerSupporterMedal, PlayerNameIcons

**Files:**
- Modify: `packages/shared-assets/scripts/generate-medals.mjs` (add a fixed `supporter` medal written to `medals/supporter.svg`; existing seeded output unchanged — generate it after the loop with its own RNG state)
- Create: `packages/shared-assets/medals/supporter.svg` (generated)
- Create: `packages/ui/src/player/player-supporter-medal.svelte`
- Create: `packages/ui/src/player/player-name-icons.svelte`
- Modify: `packages/ui/src/player/index.ts`, `packages/ui/package.json` exports if per-file
- Modify (replace `PlayerStreamerIcon` with `PlayerNameIcons`, same props): `packages/ui/src/comment/comments.svelte`, `leaderboard/leaderboard-player.svelte`, `live-lobby/live-lobby-players.svelte`, `match/team-player-list.svelte`, `player/player-byline.svelte`, `player/player-match-history.svelte`, `player/player-profile-header.svelte` (medal `size` 22), `player/player-search-card.svelte`, `player/smurf-alert.svelte`, `replay/replay-detail.svelte`, `replay/replay-overview.svelte`; `packages/app/src/lib/components/match/match-screenshots.svelte`, `player/player-alias.svelte`, `widgets/widget-dashboard-hero.svelte`, `widgets/widget-profile.svelte`, `packages/app/src/routes/(loaded)/admin/tabs/flagged-tab.svelte`

**Interfaces:**
- `PlayerSupporterMedal` props `{ labels?: PlayerLabel[] | null; steamId?: string | null; size?: number (default 16); class?: string }`; resolves labels like `PlayerStreamerIcon`; renders `<img src={medalUrl} alt="">` in a `role="img"` span with `aria-label`/tooltip `t('Supporter')` when `isSupporter(resolved)`. Medal URL via `import supporterMedal from '@company-of-heroes/shared-assets/medals/supporter.svg?url'` (follow how `tournament/medal.ts` loads medals).
- `PlayerNameIcons` same props; resolves labels once and passes them to both `PlayerSupporterMedal` and `PlayerStreamerIcon` (supporter first), wrapped in `inline-flex items-center gap-1`.

- [ ] **Step 1:** Generate the medal: `node packages/shared-assets/scripts/generate-medals.mjs`; `git diff --stat packages/shared-assets/medals` shows only `supporter.svg` added.
- [ ] **Step 2:** Build both components; run `svelte-autofixer` until clean.
- [ ] **Step 3:** Replace the 16 usages; `svelte-autofixer` each; `pnpm check`. Expected: 0 errors; `rg PlayerStreamerIcon packages/*/src` only hits `player-name-icons.svelte`, `player-streamer-icon.svelte` and `player/index.ts`.
- [ ] **Step 4:** Manual: website leaderboard, a lobby, comments and profile of the sandbox supporter show the medal; a non-supporter shows none; no layout shift for streamers.
- [ ] **Step 5:** Commit `feat(ui): supporter medal next to player names`.

### Task 7: Admin guard for system labels

**Files:**
- Modify: `packages/app/src/routes/(loaded)/admin/tabs/labels-tab.svelte`
- Modify: `packages/api/src/labels/labels.ts` (delete/assign refuse `system` labels with an `ApiError`)

**Interfaces:**
- System label row: delete button hidden, conditions field disabled with hint `t('Managed by supporter subscriptions')`, label not offered in the manual assign picker; name, colour, tooltip editable.

- [ ] **Step 1:** Implement; `svelte-autofixer`; `pnpm --filter @company-of-heroes/app check`.
- [ ] **Step 2:** Manual: in the app admin, the Supporter label cannot be deleted or hand-assigned; a new label with `supporter_months ≥ 12` can be created and saved.
- [ ] **Step 3:** Commit `feat(app): protect system labels in admin`.

### Task 8: Supporter ribbons + seeded rewards

**Files:**
- Modify: `packages/shared-assets/scripts/generate-ribbons.mjs`
- Generated: `packages/shared-assets/ribbons/ribbon-402.svg` … `ribbon-409.svg`, `ribbons.json`
- Modify: `packages/pocketbase/scripts/seed-rewards.mjs`

**Interfaces:**
- Palette `SUPPORTER = { gold: '#E0B23A', burgundy: '#6E1F2E', cream: '#EFE6CF' }`. Appended after the existing 401 entries (existing files byte-identical):
  - 402–406: series `supporter`, levels 1–5 (1–5 devices), titles "Supporter I" … "Supporter V", `raceId: null`.
  - 407: "Founding Supporter".
  - 408, 409: "Supporter Service", "Supporter Honour".
- Seed rewards (by title, idempotent like the rest of the script): "Supporter — 1 month" (`supporter_months ≥ 1`, `ribbon-402`), "— 3 months" (≥3, 403), "— 6 months" (≥6, 404), "— 12 months" (≥12, 405), "— 24 months" (≥24, 406), "Founding Supporter" (≥1, 407).

- [ ] **Step 1:** Extend the generator; run it; `git status packages/shared-assets/ribbons` shows only the 8 new files and `ribbons.json` modified (appended entries only).
- [ ] **Step 2:** Extend the seed script; run it against local PB (see script header for the command). Expected: 6 rewards created; second run creates none.
- [ ] **Step 3:** Manual: the reward catalog groups Supporter I–V as one series; the sandbox supporter unlocks "1 month" and "Founding Supporter" after the next evaluate.
- [ ] **Step 4:** Commit `feat(shared-assets): supporter ribbons and rewards`.

### Task 9: Player card page + PNG

**Files:**
- Modify: `packages/website/package.json` (add `satori`, `@resvg/resvg-wasm`; fonts: bundle the site's body font `.ttf` from `static/fonts` or add one under `src/lib/server/card/`)
- Create: `packages/website/src/lib/server/card/render.ts`
- Create: `packages/website/src/routes/api/v1/players/[id]/card.png/+server.ts`
- Modify: `packages/website/src/routes/card/[steamId=steamid]/+page.ts` → `+page.server.ts` (load) and `+page.svelte`
- Create: `packages/ui/src/supporter/player-card.svelte` (HTML card, shared)
- Modify: `packages/ui/src/player/player-profile-header.svelte` (actions snippet gets "Player card" button for own profile when supporter, via `host.links.playerCard(steamId)` port)
- Modify: `packages/ui/src/host/host.context.ts`, `packages/app/src/lib/host.ts`, `packages/website/src/lib/host.ts` (port `playerCardUrl(steamId: string): string` → `https://coh1stats.com/card/{steamId}` in app, localized `/card/{steamId}` on website)

**Interfaces:**
- `type PlayerCardData = { steamId; alias; avatarUrl: string | null; country; factions: { raceId: number; elo: number | null; rank: number | null }[]; winRate: number | null; matches: number; ribbons: Ribbon[]; supporterMonths: number; supporterSince: string }` in `packages/ui/src/supporter/types.ts`.
- `SubscriptionsService.card(steamId): Task<PlayerCardData | null>` — null when the Steam ID's account is not active (uses `playerPage.get` for stats, rewards `forPlayer` for the 5 latest unlocked ribbons).
- `renderCardPng(data: PlayerCardData, fonts): Promise<Uint8Array>` — satori 1200×630 → resvg PNG; initialise wasm once per isolate.
- `card.png` route: 404 when null; `content-type: image/png`, `cache-control: public, max-age=3600`.
- Page: null → `redirect(302, localized /players/{steamId})`; else render `PlayerCard`, "Download PNG" (`<a download href=…card.png>` via `Button`), `Seo` with `image` = absolute PNG URL.
- Missing stats → "Unranked"; missing avatar → default avatar asset (Review Focus 5).

- [ ] **Step 1:** Add deps (`pnpm --filter @company-of-heroes/website add satori @resvg/resvg-wasm`), implement `render.ts` and the PNG route.
- [ ] **Step 2:** Implement `card()`, the page, the shared `PlayerCard`, host port and profile button; `svelte-autofixer`; `pnpm check`.
- [ ] **Step 3:** `pnpm --filter @company-of-heroes/website build` then `wrangler dev`; open `/card/<supporter steamId>` and `/api/v1/players/<id>/card.png`. Expected: card renders in both; a non-supporter's card redirects and its PNG is 404; a supporter with no ranked games shows "Unranked". Check Worker bundle size stays under the plan limit (`wrangler deploy --dry-run --outdir dist` size output).
- [ ] **Step 4:** Commit `feat(website): supporter player card`.

### Task 10: Supporters page + checkout

**Files:**
- Create: `packages/ui/src/supporter/supporters-page.svelte`, `supporter-perks.svelte`, `supporter-list.svelte`, `index.ts`; Modify `packages/ui/package.json` exports
- Create: `packages/website/src/routes/supporters/+page.server.ts`, `+page.svelte` (localized like other routes; check how `/es` `/ko` are wired via hooks)
- Create: `packages/website/src/lib/paddle.ts` (load `https://cdn.paddle.com/paddle/v2/paddle.js` once, `Paddle.Environment.set`, `Paddle.Initialize({ token })`, `openCheckout(data)` → `Paddle.Checkout.open({ items: [{ priceId, quantity: 1 }], customData, customer: email ? { email } : undefined, settings: { successUrl: '/supporters?welcome=1' } })`)
- Modify: `packages/website/src/lib/components/layout/footer.svelte` (link "Supporters")
- Modify: website CSP (if set in `hooks.server.ts` / `svelte.config.js`): allow `cdn.paddle.com`, `*.paddle.com` frames

**Interfaces:**
- Consumes: `api.subscriptions.supporters()`, `.me()`, `.checkout()`, `.portal()` (Task 5).
- Page: perks (medal, ribbons, player card, name on this page), price "€5 / month", button "Become a supporter" (logged out → login with return to `/supporters?checkout=1`; `?checkout=1` while logged in auto-opens checkout), supporters see "Manage subscription" (opens portal URL). Sections "Current supporters" and "Hall of fame" (`SupporterList` rows: medal, avatar, alias → profile link, "{months} months"); empty state text for each. `?welcome=1` shows a thank-you notice (the webhook may land a few seconds later; poll `me()` up to 5× every 2 s before showing the medal state).

- [ ] **Step 1:** Implement the shared components; `svelte-autofixer`.
- [ ] **Step 2:** Implement the route, Paddle loader, footer link, CSP.
- [ ] **Step 3:** `pnpm check && pnpm check:duplicates`. Expected: 0 errors.
- [ ] **Step 4:** Manual (sandbox card `4242 4242 4242 4242`): full checkout from `/supporters` logged out → login → checkout → welcome → appears in "Current supporters"; flush borders checked on desktop and mobile (bottom of both lists, line above footer).
- [ ] **Step 5:** Commit `feat(website): supporters page and checkout`.

### Task 11: Account sections (app + website)

**Files:**
- Create: `packages/ui/src/supporter/supporter-account-section.svelte`
- Modify: `packages/website/src/routes/account/+page.svelte` (+ `+page.server.ts` if data is loaded server-side)
- Modify: `packages/app/src/routes/(loaded)/account/+page.svelte`
- Modify: `packages/ui/src/host/host.context.ts` + both `host.ts` (port `openSupporters(options?: { checkout?: boolean }): void` and `openExternal(url: string)` if not present — app opens the browser via opener, website navigates/opens the portal in a new tab)

**Interfaces:**
- Section shows from `SupporterStatus`: active → "Supporter since {date} · {months} months · next payment {date}", `Button` "Manage subscription" (portal), toggle "Hide me from the supporters page" (`setHidden`); canceled-but-running → "Ends on {date}"; not a supporter → pitch + "Become a supporter" (`host.openSupporters({ checkout: true })`).

- [ ] **Step 1:** Implement section + ports; `svelte-autofixer`; `pnpm check`.
- [ ] **Step 2:** Manual: in the app (`pnpm --filter @company-of-heroes/app dev`) the buttons open the browser at `coh1stats.com/supporters?checkout=1` / the portal; toggle hides the account from `/api/v1/supporters` (after cache) while the medal stays.
- [ ] **Step 3:** Commit `feat: supporter section on the account page`.

### Task 12: i18n, privacy, changeset, final check

**Files:**
- Modify: `packages/i18n/locales/en.json`, `es.json`, `ko.json` (every string added in Tasks 6–11)
- Modify: `POLICY.md` (Paddle as processor + merchant of record; stored: Paddle customer/subscription/transaction ids, status, period end, payment dates and amounts; no card data; public: supporter status/medal, months, since on supporters page/card unless hidden — medal always; new Effective date 2026-10-16 or release date)
- Create: `.changeset/loyal-supporters.md`

```markdown
---
'@company-of-heroes/app': minor
'@company-of-heroes/website': minor
'@company-of-heroes/ui': minor
'@company-of-heroes/api': minor
'@company-of-heroes/i18n': minor
'@company-of-heroes/pocketbase': minor
'@company-of-heroes/shared-assets': minor
'@company-of-heroes/jobs-worker': minor
---

feat; supporter subscription with medal, supporter ribbons, player card and supporters page
```

- [ ] **Step 1:** Add translations; grep each new `t('…')` key exists in all three locale files.
- [ ] **Step 2:** Update `POLICY.md`; confirm the Tauri capability allows opening `https://coh1stats.com/*` (already required for privacy links).
- [ ] **Step 3:** `pnpm check && pnpm check:duplicates && pnpm lint`. Expected: all clean.
- [ ] **Step 4:** End-to-end sandbox run from the spec's Verification section (subscribe → medal on all linked IDs + supporters page + 1-month ribbon; card page/PNG; cancel → medal gone after period end, ribbons stay; replayed webhook no double months).
- [ ] **Step 5:** Commit `chore: supporter i18n, privacy policy and changeset`.
