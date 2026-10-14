# Player compare — design

Date: 2026-10-14
Status: approved in chat, pending spec review

## Goal

A signed-in player compares themselves with any other player on one page: both players' stats side by side plus their head-to-head record. "Themselves" is all of their linked Steam accounts combined by default; they can narrow it to a selection of those accounts.

Entry points:

- the head-to-head chip popover next to a player name (match pages, live match),
- a **Compare** button on every other player's profile (app and website).

## Scope

In: one compare API endpoint, one shared `Compare.*` component family, a `/compare/[id]` route in the app and on the website, a link in the head-to-head popover, a Compare button in the shared profile header.

Out: comparing two arbitrary players (one side is always the signed-in user), comparing more than two sides, ELO history charts.

## 1. Data and backend

### Endpoint

`GET /api/v1/compare?them=<profileId|steamId>&steamIds=a,b`

- Requires a signed-in user (`requireUser`).
- `steamIds` is optional. The server intersects it with the user's linked Steam ids; omitted means all linked ids. An empty intersection (or a user with no linked ids) is a 400.
- `them` uses the same id rules as `/api/v1/players/[id]` (Steam id or Relic profile id).

### Response

```ts
type CompareAccount = {
	steamId: string;
	name: string | null;
	avatarUrl: string | null;
	profileId: number | null;
	selected: boolean;
};

type CompareBestRank = {
	leaderboardId: number;
	rank: number;
	ranklevel: number;
	wins: number;
	losses: number;
	steamId: string; // account that holds it
};

type CompareBestElo = {
	matchKey: string; // '1'..'7'
	raceKey: string; // '0'..'3'
	rating: number;
	steamId: string;
};

type Compare = {
	accounts: CompareAccount[]; // every linked account, for the toggles
	me: {
		performance: PlayerPerformance; // combined over the selected accounts
		best: CompareBestRank[]; // best rank per leaderboard
		elo: CompareBestElo[]; // highest rating per mode + faction
	};
	them: {
		steamId: string;
		profileId: number;
		alias: string;
		avatarUrl: string | null;
		country: string | null;
		level: number;
		leaderboardStats: LeaderboardStat[];
		elo: PlayerEloMap;
		performance: PlayerPerformance;
	};
	headToHead: HeadToHead; // selected accounts combined vs them
};
```

Combining rules for "me":

- `performance` (wins, losses, recent form, by faction / map / mode) comes from `lobby_player_index` rows of all selected Steam ids together, so it sums naturally.
- Rank and ELO belong to one account and are not summed: per leaderboard the account with the best (lowest positive) rank wins; per mode + faction the highest rating wins. Each entry keeps the `steamId` it came from so the UI can name the account.

### Services (`packages/website/src/lib/server/services`)

- `PerformanceService.ofSteamIds(steamIds: string[])`: same `steam_id = …` filter as `ofUser`, for an explicit list. Cached per sorted id list.
- `HeadToHeadService.forUser(userId, me, profileIds, steamIds?)`: optional subset. When given, identity is `steam_id` over `steamIds ∩ user.steamIds`, cache key `steam:<sorted ids>`.
- New `CompareService.get(userId, them, steamIds?)`, registered in `services/index.ts`. It runs in parallel:
  - `users.steamAccounts(userId)` for the account list,
  - one Relic `getpersonalstat` call with `profile_names` for all selected accounts (rank + profile ids),
  - `player_ratings` for the selected accounts (ELO),
  - `performance.ofSteamIds(selected)`,
  - `headToHead.forUser(userId, null, [themProfileId], selected)`,
  - `playerPage.get(them)` for their side (already cached 45 s, usually warm from the profile visit).
  Result cached 45 s per user + selection + them.
- Route `routes/api/v1/compare/+server.ts`: zod query schema, `handle` + `requireUser`, `cache-control: private`.

### Client (`packages/api`)

`api.compare.get({ them, steamIds? })` in `packages/api/src/compare/`, zod response schema, neverthrow, request dedupe like `headToHead`. Types exported for `packages/ui`.

### Privacy

No new data is collected or published. The page shows a user's own linked accounts and existing public stats, only to that signed-in user. `POLICY.md` stays as is; re-check at implementation end.

## 2. The page

A new compound family in `packages/ui/src/compare/`: `Compare.Root` puts the `Compare` payload (plus `selected` ids and an `onSelect` callback) in context once; children read it with `useCompare()`. Flush panels separated by 1px `border-secondary-800` lines, per `flush-borders`.

```
┌─────────────────────────────────────────────────────────────────┐
│ [avatar] You (3 accounts)           vs          Opponent [avatar]│  Compare.Header
├─────────────────────────────────────────────────────────────────┤
│ Accounts: [● Main] [● Smurf2] [○ Old]                            │  Compare.Accounts
├─────────────────────────────────────────────────────────────────┤
│ Head to head   7–4 · 11 games · 64%                  [breakdown]  │  Compare.HeadToHead
├─────────────────────────────────────────────────────────────────┤
│        You          │   Mode / stat       │       Them          │  Compare.Table
│  #312 · 1840 ELO    │   1v1               │  #95 · 2010 ELO     │
│  58% (412)          │   Win rate (games)  │  61% (980)          │
│  W W L W L …        │   Recent form       │  L W W W W …        │
├─────────────────────┼─────────────────────┼─────────────────────┤
│  By faction  — win rate per side for US / Wehrmacht / CW / PE    │  Compare.Factions
├─────────────────────┼─────────────────────┼─────────────────────┤
│  By map — maps both have played, win rate per side               │  Compare.Maps
└─────────────────────────────────────────────────────────────────┘
```

Behaviour:

- Mirrored rows: the better value per row gets the primary colour; a side without data shows `—` and nothing is highlighted.
- Rank / ELO on "my" side show which account holds it (tooltip).
- `Compare.Accounts` renders only when the user has two or more linked accounts. Toggling writes `?accounts=<steamIds>` to the URL (shareable, back button works) and reloads; the last selected account cannot be switched off. All accounts selected = no `accounts` param.
- Empty head-to-head: "No games against {alias} yet."
- `/compare/<own id>`: a notice with a link back to the profile, no comparison.
- Loading: skeleton per panel. Error: error state on the page; panels that loaded stay.

Reuse: `HeadToHeadBreakdown` (expandable, with games), `Badge`, `Button`, `Skeleton`, `getRatioColor` / `winrate` from `format/player-format`, faction flags and map names via `host.resolve`. All copy via `useI18n()` with keys in `en`, `es`, `ko`.

## 3. Routes and entry points

### Host ports (`packages/ui/src/host/host.context.ts`)

- `HostRoutes.compare?: (idOrSteamId: string | number, steamIds?: string[]) => string`. Optional so hosts without accounts (`replay-parser`) omit it and the links hide.
  - App: `/compare/<id>` (+ `?accounts=…`).
  - Website: `href('/compare/<id>')` (+ `?accounts=…`), locale prefix included.
- `HostApi.compare.get({ them, steamIds })`, implemented by both hosts with `api.compare.get`.

### Routes

- Website `routes/compare/[id=playerid]/+page.server.ts`: signed out → login redirect back to the page; else `locals.services.compare.get(user.id, id, accounts)`. `noindex`, `cache-control: private`. `+page.svelte` renders `Compare.Root` and its parts.
- App `routes/(loaded)/compare/[id]/+page.svelte`: client `resource` on `api.compare.get` keyed by id + `accounts`. Add `/compare/[id]` to `prerender.entries` in `packages/app/svelte.config.js`. Breadcrumb: Players › {alias} › Compare.
- Both route files stay thin: load data, render the shared components.

### Head-to-head popover

`packages/ui/src/head-to-head/head-to-head-chip.svelte` gets a footer row "Full comparison →" linking to `host.routes.compare(record.profileId)`, hidden when the host has no `compare` route.

### Profile button

`packages/ui/src/player/player-profile-header.svelte` gets a **Compare** button (`ScalesIcon` from phosphor, `Button` variant secondary) linking to `host.routes.compare(player.profileId)`. Shown under the same condition as the head-to-head tab: signed in and not your own profile. Shared component, so app and website get it without host code.

## Release

- One changeset: `feat; compare yourself with any player, across all or selected of your accounts` — `@company-of-heroes/app`, `website`, `ui`, `api` minor; `i18n` patch.
- No tests (project rule).
- `svelte-autofixer` on every edited `.svelte` / `.svelte.ts`; `svelte-check` in app and website.
