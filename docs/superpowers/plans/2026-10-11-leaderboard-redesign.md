# Leaderboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One shared leaderboard view (toolbar, hero with the #1's rank-20 reward, sortable list) used by both the desktop app and the website.

**Architecture:** Presentational components and pure row helpers live in `packages/ui/src/leaderboard`. Both hosts load the same `LeaderboardPageData` from `/api/v1/leaderboards/:id` and pass it in; the rank-20 reward comes through a new `/api/v1/rewards/rank/[leaderboardId]` endpoint exposed as host port `rewards.forRank`.

**Tech Stack:** Svelte 5 runes, SvelteKit (website: Cloudflare, remote functions; app: Tauri adapter-static), `@company-of-heroes/api` (neverthrow + zod), PocketBase, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-11-leaderboard-redesign-design.md`

## Global Constraints

- Work directly on `master` (user's choice).
- **No tests** (project rule `no-tests.md`): verification = `svelte-autofixer` on every edited `.svelte` file until clean, `pnpm --filter <pkg> check`, `pnpm check:duplicates`, and a manual run in both hosts.
- Every UI component exists once, in `packages/ui`; no copies or wrappers in `app`/`website` (`AGENTS.md`).
- Flush panels: 1px `border-secondary-800`, no rounded cards, exactly one line between blocks (`flush-borders.md`).
- Raw clickable elements use `interactive` from `@company-of-heroes/ui/variants` (`interactive-cursor.md`).
- `setContext` only at init (`set-context-init.md`); `$derived` for computed values, keyed `{#each}`.
- Formatting per `blank-lines.md` (curly braces on every `if`, blank line after a closing `}` when code follows).
- Rank 20 = `REWARD_RANK_MAX` from `@company-of-heroes/ui/reward/metrics`; reward metric `'rank_reached'`.
- Mode → matchtype: 1v1 = 1, 2v2 = 2, 3v3 = 3, 4v4 = 4. Race: 0 US, 1 Wehrmacht, 2 British, 3 Panzer Elite.
- Copy (English keys, add to `packages/i18n/locales/{en,es,ko}.json`): `"Jump to me"`, `"All countries"`, `"Link your account to claim this reward"`, `"Sort by {column}"`.
- Changeset `.changeset/shared-leaderboards.md`: `minor` for `@company-of-heroes/ui`, `@company-of-heroes/app`, `@company-of-heroes/website`, `@company-of-heroes/api`; `patch` for `@company-of-heroes/i18n`; summary `feat; leaderboards share one view in app and website: hero for the top 3 with the #1's rank 20 reward, column sorting, country filter and jump to me`.
- `POLICY.md` unchanged (no new data).

## Review Focus

1. **Board with fewer than 3 rows / empty board** (search or a dead 4v4 PE board): hero renders only the rows that exist, no empty #2/#3 cells, no stacked double border; empty board shows `emptyMessage`. → Task 5 verification.
2. **#1 below level 20, or no reward configured, or reward is secret**: no reward, no request error in console, no empty corner box. → Task 2 + Task 5 verification.
3. **Viewer has several Steam IDs on one board** (smurf + main): "Jump to me" targets the best rank and both rows get the own-row highlight. → Task 3 helper + Task 6 verification.
4. **Switching board while a search, country or non-rank sort is active**: all three reset, hero returns, `limit` resets to `LEADERBOARD_PAGE_SIZE`. → Task 7 verification.
5. **Sorting by ELO with rows missing ELO** (app before harvest): those rows stay at the bottom in both directions. → Task 3 helper + Task 9 verification.

---

### Task 1: Shared leaderboard modes in `ui`

**Files:**
- Create: `packages/ui/src/leaderboard/leaderboard-modes.ts`
- Modify: `packages/ui/src/leaderboard/index.ts`
- Modify: `packages/website/src/lib/leaderboards/index.ts` (drop the mode list/helpers; re-export from ui; keep the `LeaderboardPageData` types)
- Modify: `packages/website/src/routes/leaderboards/+page.server.ts` (import `parseBoardId` from ui)

**Interfaces:**
- Produces (exported from `@company-of-heroes/ui/leaderboard`):
  - `type LeaderboardFaction = { label: string; value: number; race: number }`
  - `type LeaderboardMode = { label: string; value: number; matchtypeId: number; factions: LeaderboardFaction[] }`
  - `DEFAULT_BOARD_ID = 4`, `LEADERBOARD_MODES: LeaderboardMode[]` (same values as the website list today, plus `matchtypeId` 1–4)
  - `parseBoardId(value: string | null | undefined): number`
  - `getModeForBoard(boardId: number): LeaderboardMode`
  - `boardIdForMode(mode: LeaderboardMode, currentBoardId: number): number`
  - `getFactionForBoard(boardId: number): LeaderboardFaction`
  - `boardFilter(boardId: number): { raceId: number; matchtypeId: number }`

- [ ] **Step 1:** Create `leaderboard-modes.ts`: move the list and three helpers from `packages/website/src/lib/leaderboards/index.ts` verbatim, add `matchtypeId` and the two new helpers. No Svelte/host imports.
- [ ] **Step 2:** Export everything from `packages/ui/src/leaderboard/index.ts`; update the website module and `+page.server.ts` imports.
- [ ] **Step 3:** Run `pnpm --filter @company-of-heroes/ui check` and `pnpm --filter @company-of-heroes/website check`. Expected: 0 errors.
- [ ] **Step 4:** Commit `refactor: move leaderboard modes to ui`.

### Task 2: Rank-20 reward endpoint and host port

**Files:**
- Modify: `packages/ui/src/reward/types.ts` (add `LeaderboardRankReward`)
- Modify: `packages/website/src/lib/server/services/rewards.ts` (add `rankReward`)
- Create: `packages/website/src/routes/api/v1/rewards/rank/[leaderboardId]/+server.ts`
- Modify: `packages/website/src/lib/remote/rewards.remote.ts` (add `getRankReward`)
- Modify: `packages/api/src/rewards/rewards.ts` (add `rankReward`)
- Modify: `packages/ui/src/host/host.context.ts` (port `rewards.forRank`)
- Modify: `packages/website/src/lib/host.ts`, `packages/app/src/lib/host.ts`

**Interfaces:**
- Consumes: `boardFilter(boardId)` from Task 1.
- Produces:
  - `type LeaderboardRankReward = { reward: RewardView; unlocked: boolean }`
  - `RewardsService.rankReward(leaderboardId: number, steamId: string | null): Task<LeaderboardRankReward | null>`
  - `GET /api/v1/rewards/rank/:leaderboardId?steamId=` → JSON `LeaderboardRankReward | null`; `400` for an id outside 4–19 or a malformed steamId; `cache-control: public, max-age=30, s-maxage=60, stale-while-revalidate=300`
  - `RewardsApi.rankReward(leaderboardId: number, steamId: string | null): ResultAsync<LeaderboardRankReward | null, ApiError>`
  - Host port: `rewards.forRank: (leaderboardId: number, steamId: string | null) => Promise<LeaderboardRankReward | null>`

- [ ] **Step 1:** Implement `rankReward` on `RewardsService`:
  - Use `this.catalog()`, keep `!reward.secret` rewards that have a condition with `metric === 'rank_reached' && threshold === REWARD_RANK_MAX` whose `filter.raceId`/`filter.matchtypeId` are unset or equal `boardFilter(leaderboardId)`.
  - Score = number of set filters (2 > 1 > 0); highest score wins, ties → lowest `sort` (catalog is already sorted by `sort`). No match → `okAsync(null)`.
  - With a `steamId`, look up its unlock via `this.unlocked(steamId)`.
  - Return `{ reward: this.view(reward, unlockedAt), unlocked: unlockedAt !== null }`.
  - Wrap in `cached(\`rewards:rank:${leaderboardId}:${steamId ?? ''}\`, CACHE_SECONDS, …)`.
- [ ] **Step 2:** Add the `+server.ts` route (pattern: `api/v1/leaderboards/[id]/+server.ts` + `parse`), the `getRankReward` remote `query` (object schema `{ leaderboardId, steamId }`), the `RewardsApi.rankReward` method (`sendV1` like `forPlayer`, query string `?steamId=` only when set), and the host port with both implementations (website → `getRankReward`, app → `unwrapApi(api.rewards.rankReward(...))`).
- [ ] **Step 3:** Run `check` for ui, api, website, app. Expected: 0 errors.
- [ ] **Step 4:** Run `pnpm --filter @company-of-heroes/website dev`, open `/api/v1/rewards/rank/5` and `/api/v1/rewards/rank/5?steamId=<a lvl-20 Wehrmacht 1v1 Steam ID>`. Expected: the configured reward (or `null` when none exists in the local DB; then create one in the rewards admin with `Ladder rank reached ≥ 20 · Wehrmacht · 1 VS. 1` and retry). `/api/v1/rewards/rank/99` → 400.
- [ ] **Step 5:** Commit `feat: rank 20 reward endpoint for leaderboards`.

### Task 3: Row helpers (sort, filter, countries, viewer)

**Files:**
- Create: `packages/ui/src/leaderboard/leaderboard-rows.ts`
- Modify: `packages/ui/src/leaderboard/index.ts`

**Interfaces:**
- Consumes: `LeaderboardStatRow`, `PlayerEloMap` from `../format/types`; `getStoredEloForLeaderboard` from `../format/player-format`; `countryDisplayName` from `../format/country`.
- Produces:
  - `type LeaderboardSortKey = 'rank' | 'elo' | 'wins' | 'losses' | 'streak' | 'ratio'`
  - `type LeaderboardSort = { key: LeaderboardSortKey; direction: 'asc' | 'desc' }`
  - `DEFAULT_LEADERBOARD_SORT: LeaderboardSort = { key: 'rank', direction: 'asc' }`
  - `steamIdOf(stat: LeaderboardStatRow): string` (`profile.name` without `/steam/`)
  - `eloOf(stat, eloBySteamId): number | null`
  - `filterRows(stats, { query: string; country: string | null }): LeaderboardStatRow[]` (alias contains query, case-insensitive; country exact match)
  - `sortRows(stats, sort, eloBySteamId): LeaderboardStatRow[]` (new array; `null` ELO always last; ratio = wins / (wins + losses), 0 games = 0; ties → rank asc)
  - `nextSort(current: LeaderboardSort, key: LeaderboardSortKey): LeaderboardSort` (same key flips direction; new key → `desc`, except `rank` → `asc`)
  - `countryOptions(stats, locale: string): { value: string; label: string }[]` (distinct non-empty countries, sorted by label)
  - `viewerRow(stats, steamIds: string[]): LeaderboardStatRow | null` (best rank among matches)
  - `isHeroVisible(query: string, country: string | null, sort: LeaderboardSort): boolean`

- [ ] **Step 1:** Implement the functions above in `leaderboard-rows.ts` and export them.
- [ ] **Step 2:** `pnpm --filter @company-of-heroes/ui check`. Expected: 0 errors.
- [ ] **Step 3:** Commit `feat: leaderboard sort and filter helpers`.

### Task 4: `LeaderboardToolbar`

**Files:**
- Create: `packages/ui/src/leaderboard/leaderboard-toolbar.svelte`

**Interfaces:**
- Consumes: Task 1 modes; `Input` from `../ui/input`; `Selection` (`@company-of-heroes/ui/selection`) for the country picker; `Button`; `tabTrigger`, `factionIcon` variants; `host.resolve.factionFlagByRace`.
- Produces: props
  `{ boardId: number; onBoardChange: (id: number) => void; query: string (bindable); country: string | null (bindable); countries: { value: string; label: string }[]; viewerRank: number | null; onJumpToMe: () => void }`

- [ ] **Step 1:** Build it from the website toolbar markup (mode tabs, faction flags with `aria-label={t(faction.label)}`, active label `mode · race`). Right side: "Jump to me (#{rank})" `Button` only when `viewerRank !== null`, country `Selection` with "All countries" as the empty option, search `Input` with `MagnifyingGlassIcon` leading snippet. Debounce of the search stays in the view (Task 7), the toolbar just binds `query`.
- [ ] **Step 2:** `svelte-autofixer` until clean.
- [ ] **Step 3:** Commit `feat: shared leaderboard toolbar`.

### Task 5: `LeaderboardHero`, `LeaderboardRankReward`, skeleton

**Files:**
- Create: `packages/ui/src/leaderboard/leaderboard-hero.svelte`
- Create: `packages/ui/src/leaderboard/leaderboard-rank-reward.svelte`
- Modify: `packages/ui/src/leaderboard/leaderboard-skeleton.svelte`

**Interfaces:**
- Consumes: Task 3 `eloOf`, `steamIdOf`; `RewardIcon` from `../reward`; `LeaderboardRankReward` from Task 2.
- Produces:
  - `LeaderboardHero` props `{ stats: LeaderboardStatRow[] (top 1–3); eloBySteamId; rankReward: LeaderboardRankReward | null; viewerSteamIds: string[]; loading?: boolean }`
  - `LeaderboardRankReward` props `{ value: LeaderboardRankReward; class?: string }`

- [ ] **Step 1:** Hero layout per spec/mockup `leaderboard-hero-reward-v2.html`:
  - Grid `lg:grid-cols-[1.4fr_1fr] lg:divide-x`. The #1 cell is `relative`, `bg-primary/5`, has a square avatar (`size-18`), crown and full stats line (Lvl · W · L · ratio · streak).
  - The right column has #2/#3 rows with `border-b`, wrapped `-mb-px` so the last line lands on the hero's bottom border.
  - Below `lg` everything stacks with one line between rows.
  - Reuse `PlayerProfileLink`, `PlayerLabels`, `PlayerStreamerIcon`, `PlayerLikeCount` and the ELO colour helpers from the current podium.
  - Viewer in top 3 → gold inset left accent.
- [ ] **Step 2:** `LeaderboardRankReward`:
  - Sits `absolute top-3 right-4` inside the #1 cell and renders `RewardIcon` with `value.reward`.
  - When `!value.unlocked`: wrapper `opacity-35 grayscale` and tooltip `t('Link your account to claim this reward')` instead of the icon's own tooltip.
  - Hero renders it only when `rankReward` is set and `stats[0].ranklevel === REWARD_RANK_MAX`.
- [ ] **Step 3:** Skeleton mirrors hero (big cell + two rows) above the existing table rows.
- [ ] **Step 4:** `svelte-autofixer` on all three until clean.
- [ ] **Step 5:** Commit `feat: leaderboard hero with rank reward`.

### Task 6: `LeaderboardList` sorting and own row

**Files:**
- Modify: `packages/ui/src/leaderboard/leaderboard-list.svelte`

**Interfaces:**
- Consumes: Task 3 `LeaderboardSort`, `LeaderboardSortKey`, `eloOf`, `steamIdOf`.
- Produces: new optional props `{ sort?: LeaderboardSort; onSortChange?: (key: LeaderboardSortKey) => void; viewerSteamIds?: string[] }`; each row gets `data-profile-id={stat.profile.profile_id}` (scroll target for jump-to-me).

- [ ] **Step 1:** Header cells for ELO, Wins, Losses, Streak, Ratio and `#` become `<button class={cn(interactive, …)}>` when `onSortChange` is set:
  - `aria-sort` on the `th`;
  - `aria-label={t('Sort by {column}', { column })}`;
  - a `CaretDownIcon`/`CaretUpIcon` on the active key.
- [ ] **Step 2:** Own rows (desktop table and mobile cards): `bg-primary/10` plus inset gold left accent (`shadow-[inset_3px_0_0_var(--color-primary)]`).
- [ ] **Step 3:** Mobile: add a compact sort row only if it fits without a new component; otherwise mobile keeps rank order (sort state still applies to the data).
- [ ] **Step 4:** `svelte-autofixer` until clean.
- [ ] **Step 5:** Commit `feat: sortable leaderboard list with own row`.

### Task 7: `LeaderboardView`

**Files:**
- Create: `packages/ui/src/leaderboard/leaderboard-view.svelte`
- Modify: `packages/ui/src/leaderboard/index.ts` (export `LeaderboardView`, `LeaderboardHero`, `LeaderboardToolbar`, `LeaderboardRankReward`)

**Interfaces:**
- Consumes: Tasks 3–6; `useHost().auth.user?.steamIds`; `host.locale()`.
- Produces: props
  `{ board: LeaderboardPageData | undefined; boardId: number; onBoardChange: (id: number) => void; rankReward: LeaderboardRankReward | null; loading: boolean; pageSize?: number; limit?: number (bindable) }`
  (`LeaderboardPageData` = `{ leaderboardId; stats: LeaderboardStatRow[]; eloBySteamId }`; define it in `ui/src/format/types.ts` if not present and have `api`'s type match.)

- [ ] **Step 1:** State: `query` (raw), `debouncedQuery` (250 ms, `useDebounce` from runed), `country`, `sort`.
  - `watch(() => boardId, …, { lazy: true })` resets all four and `limit = pageSize`.
  - `rows = sortRows(filterRows(board.stats, …), sort, elo)`.
  - When `isHeroVisible`: hero = `rows.slice(0, 3)` and list = `rows.slice(3)`; otherwise the list gets all rows.
- [ ] **Step 2:** Jump to me:
  - Clear query and country, reset the sort, set `limit = Math.max(limit, index + pageSize)`.
  - Then `await tick()` and `document.querySelector(\`[data-profile-id="${id}"]\`)?.scrollIntoView({ block: 'center' })`.
  - Skip the scroll for rows in the hero.
- [ ] **Step 3:** `loading || !board` → `LeaderboardSkeleton`.
- [ ] **Step 4:** `svelte-autofixer` until clean; `pnpm --filter @company-of-heroes/ui check`.
- [ ] **Step 5:** Commit `feat: shared leaderboard view`.

### Task 8: Website uses `LeaderboardView`

**Files:**
- Modify: `packages/website/src/routes/leaderboards/+page.server.ts` (also stream `rankReward`)
- Modify: `packages/website/src/routes/leaderboards/+page.svelte`

**Interfaces:**
- Consumes: Task 7 `LeaderboardView`; Task 2 `locals.services.rewards.rankReward`.

- [ ] **Step 1:** Loader returns `rankReward`, a promise chained on `board`:
  - The #1 has `ranklevel === 20` → `rankReward(boardId, steamIdOf(top))`.
  - Otherwise `null`.
  - Errors become `null`.
- [ ] **Step 2:** Page:
  - Keep `<svelte:head>`.
  - Replace the toolbar and podium/list with one `LeaderboardView`, keeping the current `{#await data.board}` / `{#await data.rankReward}` pattern. Pass `board={undefined}` and `loading` while pending.
  - `onBoardChange` = the current `selectBoard` (`goto` with `replaceState`, `noScroll`, `keepFocus`).
  - `loading={switching}` and `pageSize={Infinity}`.
- [ ] **Step 3:** `svelte-autofixer`; `pnpm --filter @company-of-heroes/website check`.
- [ ] **Step 4:** Run the website dev server and check every mode × faction, search, country, sort, jump to me (logged in), the mobile width (375px), and the line above the footer (no double line).
- [ ] **Step 5:** Commit `feat: website leaderboards use the shared view`.

### Task 9: App uses `LeaderboardView` and the leaderboard API

**Files:**
- Modify: `packages/app/src/routes/(loaded)/leaderboards/+page.svelte`
- Modify: `packages/app/src/lib/utils/game.ts` (remove `leaderboards`, lines ~217–350, if no other user remains)
- Modify/Delete: `packages/app/src/lib/components/leaderboard/leaderboard-utils.ts` → drop `getRaceLabelFromLeaderboardId` if now unused

**Interfaces:**
- Consumes: `api.leaderboards.get(boardId)` (`@company-of-heroes/api`, via the app's existing `api` instance and `unwrapApi`); `host.rewards.forRank`; Task 7.

- [ ] **Step 1:** State:
  - `boardId = $state(DEFAULT_BOARD_ID)`.
  - Snapshot captures and restores `boardId` only.
  - `boardCache` becomes `createTtlCache<LeaderboardPageData>` keyed by `boardId`.
  - A `resource` loads `unwrapApi(api.leaderboards.get(id))`.
  - The cached board shows while it loads.
- [ ] **Step 2:** Remove the per-row Steam profile, label, like and rating loading. Keep the harvest `watch`:
  - It runs over the rendered rows (`board.stats.slice(0, 3 + limit)`).
  - It reads ratings from `board.eloBySteamId`.
  - After a harvest that processed rows, `statsResource.refetch()`.
- [ ] **Step 3:** `rankReward` `resource` keyed on `boardId` + #1 Steam ID: `host.rewards.forRank(...)` only when the #1 has `ranklevel === 20`, `null` otherwise and on error.
- [ ] **Step 4:** Render `<LeaderboardView board={…} {boardId} onBoardChange={(id) => (boardId = id)} rankReward={…} loading={showSkeleton} bind:limit />`. Remove the `ToggleGroup`/`Input` toolbar and the now-unused imports.
- [ ] **Step 5:** `svelte-autofixer`; `pnpm --filter @company-of-heroes/app check`.
- [ ] **Step 6:** `pnpm tauri dev` (or the project's app dev command):
  - Same manual checks as Task 8.
  - Sorting by ELO keeps rows without ELO last.
  - Tab switch shows the cached board at once.
  - The network shows no per-row Steam/label/like requests.
- [ ] **Step 7:** Commit `feat: app leaderboards use the shared view and leaderboard api`.

### Task 10: Cleanup, i18n, changeset

**Files:**
- Delete: `packages/ui/src/leaderboard/leaderboard-podium.svelte` (and its export)
- Modify: `packages/i18n/locales/en.json`, `es.json`, `ko.json`
- Create: `.changeset/shared-leaderboards.md`

- [ ] **Step 1:** `grep -rn "LeaderboardPodium" packages --include=*.svelte --include=*.ts` → no hits besides the deleted file; delete it.
- [ ] **Step 2:** Add the four copy keys from Global Constraints to all three locales (es/ko translated).
- [ ] **Step 3:** Write the changeset exactly as in Global Constraints.
- [ ] **Step 4:** `pnpm check` (runs `check:duplicates` + every package's check). Expected: 0 errors.
- [ ] **Step 5:** Commit `chore: drop leaderboard podium, add i18n and changeset`.
