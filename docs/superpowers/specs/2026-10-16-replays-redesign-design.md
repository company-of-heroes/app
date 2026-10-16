# Replays page redesign

Date: 2026-10-16
Hosts: app (`/history`) and website (`/replays`), shared UI in `packages/ui`.

## Goal

Rebuild the replays page so browsing replays is fun and useful. Shared (member) replays become the heart of the page; community matches fill in where shared replays are thin. Players can see at a glance whether a replay is worth watching and get it into the game in one click. Sharing your own matches becomes easy.

## Decisions (from brainstorming)

- Featured replays are chosen automatically, no staff picks.
- Value comes from: rich previews, themed sections, one click to the game, community feel.
- Structure: a **Discover** view is the default; **Community matches** and **My matches** stay as an archive; the app's Replay Manager becomes **My library**.
- Discover mixes sources: shared replays first, community matches with a replay file fill in.
- Signed-in players get personal share suggestions.
- Layout direction: editorial (hero + themed rows of 4 + grid), not a carousel or a feed.
- The replay detail page stays as it is, apart from the shared "Watch in game" button.

## Assumptions

- No in-browser playback. "Watch" means: app writes the `.rec` into the CoH playback folder; website downloads it.
- No new counters (views, favourites). Everything builds on existing data: `replayStats` (doctrine, units, opening), ELO / pro, like / comment / download counts, roster.
- No schema migration is needed.

## Page structure

### Header (all views)

- Left: title "Replays" and segmented navigation: **Discover** · Community matches · My matches (· My library in the app).
- Right: search field (player or map; submitting opens the archive with that filter) and a primary **Share replay** button (upload page, or login with redirect when signed out).

### Discover (default)

1. **Share strip**: signed in and at least one candidate only.
   - Title "Share your latest matches", up to 4 compact tiles: map thumbnail, matchup, win/loss for the viewer, date, **Share** button.
   - Share opens the existing publish-from-match flow (`/replays/upload?fromMatch=<lobbyId>`).
   - Dismissable; the dismissal is a per-viewer convenience in `localStorage` (wrapped in try/catch) and returns when new candidates appear.
2. **Featured hero**
   - One large card (⅔ width on `lg`) and two medium cards stacked on the right. Stacked on mobile.
   - Large card: full-bleed map art with gradient, label "Featured · this week", title, uploader (avatar, alias), two lines of description (shared replays), both teams with names, rank or faction icon, doctrine icon and a trophy on the winning side, chips for pro + average ELO, matchup and duration, buttons **Watch in game** and **Details**.
   - Hidden when there are no candidates.
3. **Theme sections**: each a row of 4 rich cards (2 on `sm`, 1 on mobile) with a "View all" link into the archive with the matching filter. A section with fewer than 2 items is hidden.
   - **Pro 1v1s this week**: 1v1, pro.
   - **Big battles**: 3v3 or 4v4, at least 30 minutes.
   - **Decided fast**: shorter than 12 minutes.
   - **Most discussed**: highest comment count.
4. **Latest shared**: grid of rich cards, shared replays only, newest first, "Load more" button.

### Rich replay card (replaces `replay-card.svelte`)

- 16:9 map art; overlay chips: matchup, pro crown, duration. Hover brightens the art.
- Title (shared title, else map name).
- Byline: uploader avatar + alias + relative time for shared replays; "Community match" + relative time otherwise.
- Two team columns: one line per player with rank or faction icon, name, doctrine icon (when known) and `#rank` for ranked games. The winning team shows a trophy; no red/green surfaces.
- Footer: likes, comments, downloads and an icon button **Watch in game**.
- Your own account in gold, filtered players in blue (as today).

### Archive (Community matches, My matches)

- List of calm rows: map thumbnail, title with mode · duration · date below, both teams with player names, trophy on the winner, engagement counts.
- Visible filter chip bar: 1v1–4v4, Ranked, Pro, Map, Sort. Advanced filters stay in the side sheet.
- Pagination as today.

### My library (app only)

- Replaces the Replay Manager table with the archive row style and keeps its actions: rename, delete, publish, download to playback folder, local presence check, infinite scroll.

### Watch in game

- One shared button component calling `host.api.replays.download(detail)`.
- App: writes to the playback folder; toast "Ready in your replays menu".
- Website: browser download; on the first download per viewer a short popover explains where to put the file (the `playback` folder in the CoH directory).

## Data and backend

### `GET /api/v1/replays/discover`

- New `ReplaysService.discover()` in `packages/website/src/lib/server/services/replays.ts`; route under `packages/website/src/routes/api/v1/replays/discover/+server.ts` via `handle()`.
- New `api.replays.discover()` in `packages/api` (zod schema with passthrough items).
- Response: `{ featured: CommunityMatch[], sections: { id: 'pro-1v1' | 'big-battles' | 'fast' | 'discussed', items: CommunityMatch[] }[], latestShared: { items: CommunityMatch[], totalItems: number } }`.
- Cached for 300 s (same cache approach as `top()`).
- The old `top()` strip on the replays page is removed; the home page keeps using `top()`.

### Featured score

- Candidates: shared replays and community matches with a replay file from the last 7 days; widen to 30 days when there are fewer than 3.
- `score = downloads + 3 × likes + 2 × comments + 5 (pro) + 4 (shared replay)`.
- Top 3, at most one per uploader (community matches count as no uploader).

### Theme queries

- Use existing indexed fields only (`lobbies`: `isPro`, `matchtypeId`, `durationSeconds`, `hasReplay`, `commentCount`, `createdAt`; `replays`: `visibility = 'member'`, `durationInSeconds`, `statsSnapshot`, `commentCount`, `createdAt`), bounded by the same 7 / 30-day window.
- Pro for shared replays uses the existing `isProGameplayMatch` on `statsSnapshot` in memory (the member set is small).
- Shared replays first, then community matches, up to 4 per section, no duplicates across hero and sections.
- "View all" maps each theme to an existing `ReplaysQuery` on the community archive (`pro + 1v1`; `3v3,4v4 + duration ≥ 1800`; `duration < 720`; `sort = commentCount desc`).

### List data additions

- `CommunityPlayer.doctrine?: string`, filled from `replayStats` where present (both collections), for list and discover responses.
- `CommunityMatch.uploadedBy?: { id, alias, avatarUrl }` on list and discover responses for shared replays.

### `GET /api/v1/replays/share-candidates`

- Signed-in only (`requireUser`). Up to 4 of the user's own lobbies from the last 14 days with a replay file and an empty `memberReplay`, newest first.
- New `api.replays.shareCandidates()`.

### Errors and empty states

- Each discover part is computed independently; a failing part is logged and left out.
- If discover fails entirely, the page shows Latest shared via the existing member list.
- Empty Discover (no shared replays at all) shows an invitation to share with the upload button.

## Shared UI layout

New folder `packages/ui/src/replay-browse/` (export `./replay-browse` in `packages/ui/package.json`):

- `replays-page.svelte`: root with header, navigation and context (`createReplaysPage` / `useReplaysPage`, set once at init with getters).
- `discover-view.svelte`, `featured-hero.svelte`, `theme-section.svelte`, `share-strip.svelte`, `latest-shared.svelte`.
- `archive-list.svelte`, `archive-row.svelte`, `archive-filter-bar.svelte`.
- `watch-button.svelte`.
- The rich card replaces `packages/ui/src/replay/replay-card.svelte`; `TeamPlayerList` / `ReplayTeam` (added earlier in this session) are folded into it.
- Host differences go through `useHost()`; new ports only if needed (e.g. `host.api.replays.discover`, `host.api.replays.shareCandidates`).
- Flush panels: 1px `border-secondary-800` lines, no cards with gaps; check every column bottom and the line above the footer.

## Hosts

- **Website** `/replays`: Discover by default; archive via `?view=community|mine` with the existing URL filters; the `member` tab is retired and its links point to Discover / Latest shared. SEO title, description and canonical stay correct per view.
- **App** `/history`: same `ReplaysPage`; My library keeps the Replay Manager behaviour; the app-only tables in `history/+page.svelte`, `member-replays.svelte` and `replays/replay-table.svelte` are removed or reduced to data adapters.

## Out of scope

- In-browser playback, view counters, favourites, staff picks.
- Redesign of the replay detail page (only the Watch in game button changes).

## Build order

1. Backend: `discover`, `share-candidates`, doctrine and uploader in list data; api client methods.
2. Rich card and Watch in game button.
3. Discover view: hero, themes, latest shared, share strip.
4. Archive list and filter bar.
5. Website route.
6. App route with My library.
7. i18n (en / es / ko), `POLICY.md` check, one changeset replacing `.changeset/roomy-replays.md`.

## Verification

- `svelte-autofixer` on every edited `.svelte` / `.svelte.ts` file until clean.
- `pnpm check` for ui, website, app, api; `tsc` where applicable.
- Browser check of the website on desktop and mobile (flush borders, empty states, signed-in share strip).
- No tests (project rule).
