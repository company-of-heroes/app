# Leaderboard redesign: one shared view, hero, rank-20 reward

Date: 2026-10-11 · Status: approved design, awaiting plan

## Goal

The leaderboards look and behave differently from the rest of the UI and differ between the
desktop app and the website. This project (sub-project 1 of 3):

1. Makes one shared leaderboard view in `packages/ui`, used by both hosts.
2. Replaces the rounded-card podium with a flush **hero** (direction C).
3. Shows the **rank 20 reward** of the board in the #1 player's hero card.
4. Adds column **sorting**, a **country filter** and **"Jump to me"**.

Sorting, country filter and jump-to-me (originally sub-project 2) are client-only and folded in.

Out of scope: **rank change (Δ)** (sub-project 3) needs daily board snapshots in PocketBase
plus a cron; it gets its own spec. No Δ column is added now.

## Current state

- Shared: `LeaderboardPodium`, `LeaderboardList`, `LeaderboardSkeleton`, `LeaderboardStatPill`
  in `packages/ui/src/leaderboard`.
- Per host, duplicated:
  - Toolbar: the website uses raw `tabTrigger` buttons and its own search `label`; the app uses
    `ToggleGroup` + `Input`.
  - Mode/faction lists: website `$lib/leaderboards` (`LEADERBOARD_MODES`), app `leaderboards`
    in `$lib/utils/game`.
  - Data: the website loads the full enriched board via SSR (`locals.services.leaderboard.get`);
    the app calls `relic.getLeaderboard` and enriches only the rendered rows (Steam avatars,
    labels, likes, ratings, rating harvest).

## Layout

```
┌ Toolbar ──────────────────────────────────────────────────────────────┐
│ [1v1][2v2][3v3][4v4]  ⚑⚑⚑⚑            [↓ Jump to me] [Country ▾] [🔍] │
├ Hero ─────────────────────────────────────────┬───────────────────────┤
│ [avatar]  #1 👑 flag Alias              [ribbon]│ #2 [av] Alias  ELO   │
│           ELO                                   │      Lvl · W · L      │
│           Lvl · W · L · ratio · streak          ├───────────────────────┤
│                                                 │ #3 [av] Alias  ELO   │
├─────────────────────────────────────────────────┴───────────────────────┤
│ #  Rank  Player             ELO▼  W   L   Streak  Ratio               │
│ 4  …                                                                   │
│ ▌412 … (own row: gold left accent + tint)                              │
└────────────────────────────────────────────────────────────────────────┘
```

- Flush panels: 1px `border-secondary-800` lines, no rounded cards, square avatars
  (see `flush-borders` rule: exactly one line between blocks, check the bottom of the hero's
  right column and the line above the website footer).
- On mobile the hero stacks: #1 full width, #2 and #3 below as rows.
- Mockups: `.superpowers/brainstorm/728-1791719740/content/leaderboard-hero-reward-v2.html`.

### Hero visibility

The hero shows only when sorted by rank (default), with no search query and no country filter.
Otherwise the table starts at the top and lists every matching row (ranks 1–3 included).

## Components (`packages/ui/src/leaderboard/`)

| Component | Role |
|---|---|
| `LeaderboardView` (new) | Full page content: toolbar, hero, list. Props: `board: LeaderboardPageData`, `boardId`, `onBoardChange(id)`, `rankReward`, `loading`, bindable `limit`. Owns search, country, sort state; resets them when `boardId` changes. |
| `LeaderboardToolbar` (new) | Mode tabs + faction flags (`tabTrigger`), country `Select`, shared `Input` search, "Jump to me" `Button` (only when the viewer is on the board). Replaces both host toolbars. |
| `LeaderboardHero` (replaces `LeaderboardPodium`) | #1 large, #2/#3 compact; loading state; renders `LeaderboardRankReward` top-right in the #1 card. |
| `LeaderboardRankReward` (new) | The board's rank-20 reward via the existing `RewardIcon`. Unlocked → normal with date tooltip. Not unlocked (e.g. no linked account) → faded with tooltip "Link your account to claim this reward". |
| `LeaderboardList` (changed) | Sortable column headers, own-row highlight, scroll target for "Jump to me". |
| `LeaderboardSkeleton` (changed) | Matches the hero layout. |
| `leaderboard-modes.ts` (new) | `LEADERBOARD_MODES`, `boardIdForMode`, `getModeForBoard`, moved from the website; the app's `leaderboards` list is removed in favour of it. |

`LeaderboardPodium` is deleted once both hosts use the hero.

## Data flow

### Board

- Both hosts use the same `LeaderboardPageData` (`leaderboardId`, `stats`, `eloBySteamId`)
  from `/api/v1/leaderboards/:id`.
- **Website:** unchanged loader (SSR, `?board=` in the URL, `goto` on board change with the
  skeleton while navigating).
- **App:** switches from `relic.getLeaderboard` + per-row enrichment to
  `LeaderboardsApi.get(boardId)` from `@company-of-heroes/api`. Keeps:
  - `boardCache` stale-while-revalidate (shows the cached board at once on a tab switch);
  - the rating **harvest** for rendered rows (`selectLeaderboardHarvestProfileIds` /
    `harvestPlayerRatingsForProfiles`), and a board refetch after a harvest that processed rows;
  - the `Snapshot` of the selected board.
  Removed: per-row Steam profile, label, like and rating loading on the leaderboard page.
- `limit` (lazy rendering, `LEADERBOARD_PAGE_SIZE` rows per step) stays in the app; the website
  keeps `pageSize={Infinity}` for SSR.

### Sorting

- Keys: rank (default, ascending), ELO, wins, losses, streak, ratio. First click sorts
  descending, second ascending; rank starts ascending.
- Rows without ELO always sort last.
- The `#` column always shows the Relic rank.

### Country filter

- Options: distinct `stat.profile.country` values on the board, sorted by
  `countryDisplayName(country, locale)`, plus "All countries". Rows without a country only
  appear under "All countries".
- Combines with search (alias contains query, case-insensitive, as today).

### Jump to me

- Viewer Steam IDs from `HostUser.steamIds` (`useHost()`); on multiple matches the best rank wins.
- Click: clear search and country, sort by rank, raise `limit` until the row is rendered, then
  `scrollIntoView({ block: 'center' })`.
- Own row: gold left accent + light gold tint in the list; also in the hero when the viewer is top 3.

### Rank-20 reward

- New website endpoint `GET /api/v1/rewards/rank/[leaderboardId]?steamId=`:
  - From the cached reward catalog, picks enabled, **non-secret** rewards with a
    `rank_reached` condition with threshold 20 whose `raceId`/`matchtypeId` filters fit the
    board (an unset filter fits anything). Most specific wins (both filters > one > none); ties →
    lowest `sort`.
  - Returns `{ reward: RewardView, unlocked: boolean }` with `unlockedAt` filled when
    `steamId` has it in `steam_rewards`, or `null` when no reward fits.
  - Board → race/matchtype via the existing leaderboard id mapping.
  - Cache headers like the leaderboard endpoint.
- `RewardsApi.rankReward(leaderboardId, steamId)` in `packages/api`.
- Host port `rewards.forRank(leaderboardId, steamId)` in `host.context.ts`, implemented in
  `packages/app/src/lib/host.ts` and `packages/website/src/lib/host.ts`.
- Fetched only when the board has loaded and #1 has `ranklevel === 20`; otherwise no reward.
  Website: in the page load (streamed). App: async after the board.
- Errors: the corner stays empty; no toast.

## i18n

New strings in `en`, `es`, `ko`: "Jump to me", "All countries", "Link your account to claim
this reward", sort header aria labels.

## Privacy

No new data: rewards and unlocks are already public. `POLICY.md` unchanged.

## Changeset

`minor` for `@company-of-heroes/ui`, `app`, `website`, `api`; `patch` for `i18n`:
`feat; leaderboards share one view in app and website: hero for the top 3 with the #1's rank 20 reward, column sorting, country filter and jump to me`

## Verification

- Both hosts: every mode × faction loads; hero/reward correct; sorting, country, search,
  jump-to-me; skeleton on switch; mobile width; flush-border checks (hero right column bottom,
  line above the website footer).
- Svelte autofixer on every edited `.svelte` file; `pnpm check:duplicates`; type check.
- No new tests (project rule).
