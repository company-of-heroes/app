# Player Compare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in player compares themselves (all or selected linked Steam accounts) with any player on `/compare/[id]` in the app and on the website, reachable from the head-to-head popover and a Compare button on profiles.

**Architecture:** One website service + `GET /api/v1/compare` builds the whole payload (my combined side, their side, head-to-head). `packages/api` gets `api.compare.get`. A shared `Compare.*` family in `packages/ui` renders it; app and website routes are thin loaders. Entry points live in shared ui components behind an optional `host.routes.compare`.

**Tech Stack:** SvelteKit (Svelte 5 runes, `experimental.async`), PocketBase, neverthrow, zod v4, runed, Tailwind, pnpm + Turbo.

**Spec:** `docs/superpowers/specs/2026-10-14-player-compare-design.md`

## Global Constraints

- No tests (project rule `no-tests`): no `*.test.ts` / `*.spec.ts`; verify with `svelte-check`, `svelte-autofixer` and a manual run instead of a red/green cycle.
- Every edited `.svelte` / `.svelte.ts`: `mcp__svelte__svelte-autofixer` (`async: true`) until clean.
- All user copy via `t()` / `useI18n()`; every new key in `packages/i18n/locales/en.json`, `es.json`, `ko.json` (translate es/ko).
- Shared UI only in `packages/ui` (no `$lib`, `$core`, `$app`, Tauri there); hosts stay thin.
- Flush borders: exactly one 1px `border-secondary-800` line between blocks; rows `border-b`, lists `-mb-px`.
- Raw clickable elements get `cursor-pointer` (`interactive` from `@company-of-heroes/ui/variants`); prefer `Button`.
- Phosphor imports end in `Icon` (`import ScalesIcon from 'phosphor-svelte/lib/ScalesIcon'`).
- Compound family: `Compare.Root` sets context once at init with getters; children use `useCompare()`; no snippets declared directly inside `<Compare.Root>`.
- neverthrow: `.andThen` chains, no `safeTry` / `yield*`.
- `steamIds` from the client are always intersected with the user's linked ids server-side.
- Changeset text verbatim: `feat; compare yourself with any player, across all or selected of your accounts`.
- Commit only the files of the task (`git commit -- <paths>`); the working tree holds unrelated user changes.

## Review Focus

- `steamIds` containing an id the user does not own → silently dropped; only ids outside the user's links → 400 "Select at least one of your accounts.". Owned by Task 1 (Step 4 manual check).
- `them` is one of the user's own accounts (by Steam id or profile id) → page shows the "This is you" notice, no comparison and no 400. Owned by Task 1 (`isSelf` flag) and Tasks 5/6.
- User with exactly one linked account → no account toggles, page works. Owned by Task 3 (`Compare.Accounts` renders nothing).
- A selected account that has never played a ranked game (no Relic stats / no `player_ratings` row) → it adds nothing to rank/ELO, no crash, `—` where empty. Owned by Task 1 (`bestRanks` / `bestElo` skip missing) and Task 3.
- Switching the last selected account off → ignored (toggle disabled). Owned by Task 3.

---

## File Structure

```
packages/website/src/lib/server/domain/compare.ts          pure combine helpers + Compare types
packages/website/src/lib/server/services/compare.ts        CompareService
packages/website/src/lib/server/services/performance.ts    + ofSteamIds
packages/website/src/lib/server/services/head-to-head.ts   + steamIds subset
packages/website/src/lib/server/services/index.ts          + compare getter
packages/website/src/routes/api/v1/compare/+server.ts      endpoint
packages/api/src/compare/{compare.ts,index.ts}             client
packages/api/src/client.ts, index.ts                       register + export
packages/ui/src/compare/*                                  Compare family
packages/ui/package.json                                   "./compare" export
packages/ui/src/host/host.context.ts                       HostRoutes.compare?
packages/ui/src/head-to-head/head-to-head-chip.svelte      footer link
packages/ui/src/player/player-profile-header.svelte        Compare button
packages/website/src/lib/host.ts, routes/compare/[id=playerid]/*
packages/app/src/lib/host.ts, routes/(loaded)/compare/[id]/+page.svelte, svelte.config.js
packages/i18n/locales/{en,es,ko}.json
.changeset/fair-scales.md
```

Spec deviation: no `HostApi.compare` port. Both routes load data themselves (website server load, app `resource`), and account toggles navigate via `onSelect`, so a data port would have no caller.

---

### Task 1: Compare backend (website)

**Files:**
- Create: `packages/website/src/lib/server/domain/compare.ts`
- Create: `packages/website/src/lib/server/services/compare.ts`
- Create: `packages/website/src/routes/api/v1/compare/+server.ts`
- Modify: `packages/website/src/lib/server/services/performance.ts` (add method next to `ofProfile`, ~line 31)
- Modify: `packages/website/src/lib/server/services/head-to-head.ts` (`identityFor` ~61, `forUser` ~88)
- Modify: `packages/website/src/lib/server/services/index.ts` (getter next to `headToHead`, ~129)

**Interfaces:**
- Produces (domain/compare.ts), exported types used by Tasks 2 and 3 (copy shapes verbatim from spec §1 "Response"): `CompareAccount`, `CompareBestRank`, `CompareBestElo`, `Compare` — plus `Compare.isSelf: boolean` (true when `them` resolves to one of the user's linked Steam ids; then `me`/`headToHead` may be empty).
- Produces: `bestRanks(stats: { steamId: string; leaderboardStats: LeaderboardStat[] }[]): CompareBestRank[]` — per `leaderboard_id` keep the lowest `rank > 0`; ties → more wins.
- Produces: `bestElo(maps: { steamId: string; elo: EloMap }[]): CompareBestElo[]` — per `matchKey`+`raceKey` keep the highest `rating`.
- Produces: `PerformanceService.ofSteamIds(steamIds: string[]): Task<PlayerPerformance>` — cache key `performance:steam:${[...steamIds].sort().join(',')}`, same `CACHE_SECONDS`, filter `steam_id = {:steamId}` joined by ` || `; empty list → `summarizePerformance([])`.
- Produces: `HeadToHeadService.forUser(userId, me, profileIds, steamIds?: string[])` — when `steamIds` given, identity = `steamIds ∩ user.steamIds`, key `steam:${sorted.join(',')}`; existing callers unchanged.
- Produces: `CompareService.get(userId: string, them: string, steamIds?: string[]): Task<Compare>`; `services.compare`.
- Produces: `GET /api/v1/compare?them=…&steamIds=a,b` → `Compare` JSON.

- [ ] **Step 1: Add `ofSteamIds` and the `steamIds` subset to head-to-head**

Reuse `rowsFor` / `identityFor`; do not duplicate the filter building.

- [ ] **Step 2: Write `domain/compare.ts`** with the types and `bestRanks` / `bestElo` (pure, no I/O).

- [ ] **Step 3: Write `CompareService` and register `services.compare`**

`get` flow (one `.andThen` chain, parallel with `all`):
1. `users.steamAccounts(userId)` → linked accounts; `selected = steamIds?.length ? steamIds.filter(id => linked has id) : all linked`; empty → `errAsync(badRequest('Select at least one of your accounts.'))`.
2. In parallel: `playerPage.get(them)`; one Relic `getpersonalstat` with `profile_names=[/steam/<id>…]` for `selected` (reuse `profileFromPersonalStat` per member name, as in `player-page.ts:68`); `player_ratings` `getFullList` filtered `steamId = …` over `selected` (fields `steamId,elo`, map with `toEloMap`); `performance.ofSteamIds(selected)`.
3. If `them.steamId` is in linked → return with `isSelf: true`, `headToHead: emptyHeadToHead(them.profileId)`.
4. Else `headToHead.forUser(userId, null, [them.profileId], selected)`.
5. Wrap in `cached(\`compare:${userId}:${sorted selected}:${them}\`, 45, …)`.
`accounts[i].profileId` comes from the personalstat members (null if not found).

- [ ] **Step 4: Write the route and verify**

`+server.ts`: zod `{ them: z.string().min(1), steamIds: z.string().optional().transform(split on ',' → filter Boolean) }`, `handle` + `requireUser` + `parseQuery`, response header `cache-control: private, no-store` (return `json(value, { headers })`).

Run: `pnpm --filter @company-of-heroes/website check`
Expected: no new errors in the touched files.

Manual (dev server, signed-in browser): `/api/v1/compare?them=<a profile id>` → 200 with `accounts`, `me.performance`, `them.alias`, `headToHead`; `&steamIds=76561190000000000` (not yours) → 400 "Select at least one of your accounts."; `them=<your own steam id>` → `isSelf: true`.

- [ ] **Step 5: Commit**

```bash
git add packages/website/src/lib/server/domain/compare.ts packages/website/src/lib/server/services/compare.ts packages/website/src/routes/api/v1/compare/+server.ts
git commit -m "feat(website): compare endpoint" -- packages/website/src/lib/server packages/website/src/routes/api/v1/compare
```

---

### Task 2: API client (`packages/api`)

**Files:**
- Create: `packages/api/src/compare/compare.ts`, `packages/api/src/compare/index.ts`
- Modify: `packages/api/src/client.ts` (next to `headToHead`, lines 6/31/58), `packages/api/src/index.ts` (~214)

**Interfaces:**
- Consumes: `Compare` JSON shape from Task 1.
- Produces: types `Compare`, `CompareAccount`, `CompareBestRank`, `CompareBestElo` (re-declared here as zod-inferred types; `them.performance` / `me.performance` use the existing `PlayerPerformance` type from `packages/api/src/player-performance`, `headToHead` the existing `HeadToHead`).
- Produces: `class CompareApi { get(options: { them: string | number; steamIds?: string[] }): ResultAsync<Compare, ApiError> }`, exposed as `api.compare`.

- [ ] **Step 1: Implement `CompareApi`** following `head-to-head.ts`: `sendV1(this.deps, \`/compare?${params}\`, { timeoutMs: 30_000 })`, zod `safeParse`, error message `'Failed to load comparison.'`. No client cache (server caches 45 s).

- [ ] **Step 2: Register + export, verify**

Run: `pnpm --filter @company-of-heroes/api exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit** `feat(api): compare client` with the four files.

---

### Task 3: Shared `Compare` family (`packages/ui`) + i18n

**Files:**
- Create: `packages/ui/src/compare/context.ts`, `compare-root.svelte`, `compare-header.svelte`, `compare-accounts.svelte`, `compare-head-to-head.svelte`, `compare-table.svelte`, `compare-factions.svelte`, `compare-maps.svelte`, `compare-skeleton.svelte`, `index.ts`
- Modify: `packages/ui/package.json` (exports: `"./compare": "./src/compare/index.ts"`)
- Modify: `packages/i18n/locales/{en,es,ko}.json`

**Interfaces:**
- Consumes: `Compare` types from `@company-of-heroes/api` (Task 2).
- Produces:
  - `createCompare(value: CompareContext)`, `useCompare(): CompareContext` with `CompareContext = { readonly compare: Compare; readonly selected: string[]; onSelect(steamIds: string[]): void }`.
  - `Compare.Root` props `{ compare: Compare; selected: string[]; onSelect: (steamIds: string[]) => void; children: Snippet }`.
  - `Compare.Header`, `Compare.Accounts`, `Compare.HeadToHead`, `Compare.Table`, `Compare.Factions`, `Compare.Maps` — no data props, only `class?`.
  - `Compare.Skeleton` (loading state for the app).

- [ ] **Step 1: Context + Root** per `compound-root-context` (getters, no wrapper element).

- [ ] **Step 2: Panels** — layout per spec §2 drawing:
  - Header: my avatar (first selected account) + "You" + `{count} accounts` when >1; "vs"; their avatar + alias linking `host.routes.player(them.profileId)`.
  - Accounts: renders nothing when `compare.accounts.length < 2`; one toggle `Button` per account (avatar + name ?? steamId), `aria-pressed`; the only selected one is `disabled`; click → `onSelect(next)`.
  - HeadToHead: summary line (`{wins}–{losses}`, `{count} games`, `winrate`) + `HeadToHeadBreakdown expandable`; zero games → "No games against {alias} yet."; hidden when `compare.isSelf`.
  - Table: one row per leaderboard present on either side (label via existing leaderboard-name helper), my cell `#rank · ELO` (tooltip: account name holding it), their cell same; rows "Win rate (games)" and "Recent form" (W/L from `performance.recentMatches`). Better value → `text-primary`; missing → `—`.
  - Factions: 4 rows (race 0–3, flag via `host.resolve.factionFlagByRace`), win rate per side from `performance.byFaction`.
  - Maps: maps present in both `byMap` lists, win rate per side; none → hide panel.
  - Rows `border-secondary-800 border-b`, lists `-mb-px`.

- [ ] **Step 3: i18n keys** (en / es / ko) for: `You`, `{count} accounts`, `vs`, `Accounts`, `Head to head`, `No games against {alias} yet.` (exists — reuse), `Win rate (games)`, `Recent form`, `By faction`, `By map`, `Compare`, `Full comparison`, `This is you`, `You cannot compare yourself with your own account.`, `Back to profile`, `Select at least one of your accounts.`, `Could not load the comparison.` — skip keys that already exist.

- [ ] **Step 4: Verify**

Run autofixer on every new `.svelte`; `pnpm --filter @company-of-heroes/ui check` (or the package's svelte-check script).
Expected: autofixer clean; no errors in `src/compare/`.

- [ ] **Step 5: Commit** `feat(ui): compare components` with `packages/ui/src/compare`, `packages/ui/package.json`, locale files.

---

### Task 4: Entry points (popover link + profile button)

**Files:**
- Modify: `packages/ui/src/host/host.context.ts` (`HostRoutes`, ~line 97)
- Modify: `packages/ui/src/head-to-head/head-to-head-chip.svelte` (after `<HeadToHeadBreakdown>`, line ~48)
- Modify: `packages/ui/src/player/player-profile-header.svelte` (header actions, line ~164)
- Modify: `packages/ui/src/player/player-profile.svelte` (pass `showCompare` = existing `showHeadToHead`)

**Interfaces:**
- Produces: `HostRoutes.compare?: (idOrSteamId: string | number, steamIds?: string[]) => string` — `steamIds` becomes `?accounts=a,b`.
- Produces: `PlayerProfileHeader` prop `showCompare?: boolean` (default false).

- [ ] **Step 1: Port** — add `compare?` with a doc comment ("Compare page of the signed-in user vs this player; hosts without accounts omit it").

- [ ] **Step 2: Chip footer** — when `host.routes.compare` exists: a bottom row link `t('Full comparison')` + arrow icon to `host.routes.compare(record.profileId)`, `border-secondary-800 border-t`, `interactive`.

- [ ] **Step 3: Profile button** — when `showCompare && host.routes.compare`: `Button` `variant="secondary"` `href={host.routes.compare(player.profileId)}` with `ScalesIcon` + `t('Compare')`, rendered in the header actions before `actionsSnippet`.

- [ ] **Step 4: Verify** — autofixer on the three `.svelte` files; ui check passes.

- [ ] **Step 5: Commit** `feat(ui): compare links from head to head and profiles`.

---

### Task 5: Website route

**Files:**
- Modify: `packages/website/src/lib/host.ts` (routes block ~line 197): `compare: (id, steamIds) => href(\`/compare/${id}\`) + (steamIds?.length ? \`?accounts=${steamIds.join(',')}\` : '')`
- Create: `packages/website/src/routes/compare/[id=playerid]/+page.server.ts`, `+page.svelte`

**Interfaces:**
- Consumes: `locals.services.compare.get` (Task 1), `Compare.*` (Task 3).

- [ ] **Step 1: Load** — no `locals.user` → `redirect(303, loginRedirectHref(url.pathname + url.search, locals.locale))` (as `routes/account/+page.server.ts:10`); else `unwrapAsync(locals.services.compare.get(locals.user.id, params.id, accounts))` with `accounts = url.searchParams.get('accounts')?.split(',').filter(Boolean)`; `setHeaders({ 'cache-control': 'private, no-store' })`. Return `{ compare, selected }` where `selected = compare.accounts.filter(a => a.selected).map(a => a.steamId)`.

- [ ] **Step 2: Page** — `<svelte:head>` title `{t('Compare')} · {alias}` + `<meta name="robots" content="noindex">`; `compare.isSelf` → notice + `Button href={host.routes.player(id)}` "Back to profile"; else `Compare.Root` with `onSelect = (ids) => goto(host.routes.compare(params.id, ids.length === compare.accounts.length ? undefined : ids))` and the six panels in spec order.

- [ ] **Step 3: Verify** — autofixer; `pnpm --filter @company-of-heroes/website check`; dev server: signed out → login redirect back; signed in → page renders, toggling an account updates `?accounts=` and the numbers; `/es/compare/<id>` localized; bottom line above the footer is single (flush-borders).

- [ ] **Step 4: Commit** `feat(website): compare page`.

---

### Task 6: App route

**Files:**
- Modify: `packages/app/src/lib/host.ts` (routes ~line 52), same `compare` shape without `href`.
- Create: `packages/app/src/routes/(loaded)/compare/[id]/+page.svelte`
- Modify: `packages/app/svelte.config.js` (`prerender.entries`, add `'/compare/[id]'`)

**Interfaces:**
- Consumes: `api.compare.get` via `$core/api` (`api`, `unwrapApi`), `Compare.*`.

- [ ] **Step 1: Page** — `accounts = $derived(page.url.searchParams.get('accounts')?.split(',').filter(Boolean))`; `resource(() => [page.params.id, accounts?.join(',') ?? ''] as const, ([id, acc]) => unwrapApi(api.compare.get({ them: id!, steamIds: acc ? acc.split(',') : undefined })))`; `SetCrumbs` items `[{ label: t('Players'), href: '/players' }, { label: alias, href: \`/players/${id}\` }, { label: t('Compare') }]`; loading → `Compare.Skeleton`; error → message `t('Could not load the comparison.')`; `isSelf` → notice; else `Compare.Root` + panels, `onSelect` → `goto(host-style href, { replaceState: true, keepFocus: true, noScroll: true })`.

- [ ] **Step 2: Verify** — autofixer; `pnpm --filter @company-of-heroes/app exec svelte-check --threshold error` shows only the pre-existing errors (`recovery.test.ts`, `match-rating.svelte`, `vite.config.js`); in `pnpm tauri dev`: profile → Compare → page; live match chip → popover → Full comparison → page; toggles work.

- [ ] **Step 3: Commit** `feat(app): compare page`.

---

### Task 7: Release bookkeeping

**Files:**
- Create: `.changeset/fair-scales.md`
- Check: `POLICY.md`

- [ ] **Step 1: Changeset**

```markdown
---
'@company-of-heroes/app': minor
'@company-of-heroes/website': minor
'@company-of-heroes/ui': minor
'@company-of-heroes/api': minor
'@company-of-heroes/i18n': patch
---

feat; compare yourself with any player, across all or selected of your accounts
```

- [ ] **Step 2: Policy** — confirm `POLICY.md` already covers showing linked Steam accounts and match stats to the signed-in user; change nothing unless it does not.

- [ ] **Step 3: Commit** `chore: compare changeset`.
