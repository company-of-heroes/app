---
name: app-vs-landing
description: Decides whether a change belongs in packages/app (Tauri desktop), packages/landing (coh1stats.com), both, or packages/ui. Maps counterpart routes and host adapters so the same product surface is not implemented in only one host by accident. Use when editing app or landing UI, player profiles, leaderboards, replays, comments, auth/login, shared components, or when the user asks to switch hosts, do the same on the website, also in the desktop app, or whether something must be built in both.
---

# App vs landing

Two SvelteKit hosts share `@company-of-heroes/ui`, `@company-of-heroes/api`, and public PocketBase APIs. They are not copies of each other. Before writing code, pick a host (or both) and find the counterpart.

## Decide first

Classify the work. Do not start in the package that happens to be open.

| Kind | Where |
|---|---|
| Desktop / Tauri / local game | `packages/app` only |
| Marketing / SEO / Cloudflare site chrome | `packages/landing` only |
| Public product surface (players, leaderboards, replays, comments, account) | **both** hosts; presentational UI in `packages/ui`; client I/O in `packages/api`; public HTTP hooks in `packages/pocketbase` |
| Presentational UI used by both | `packages/ui` first, then thin host adapters |
| Shared PocketBase / API client logic | `packages/api` (`createApi`); hosts inject PB + fetch |

**App-only:** live lobby writes from game, current game, history watchers, settings, shortcuts, Twitch, admin, splash/onboarding, Tauri commands, `$core`, `Feature` classes, screenshots/anti-cheat capture, local match list (`Match.ListTable`).

**Landing-only:** home/download/fair-play marketing, `/privacy` (renders `POLICY.md`), `/card` OG images, `/login` `/register` `/logout` cookie auth, `+page.server.ts` / `+server.ts` / `$lib/remote/*.remote.ts`, neverthrow unwrap + rate-limited replay file proxy.

**Both (check the other host):** player profile, player search, leaderboards, replay list/detail, match comments/likes, website vs desktop login, player performance, labels/smurf UI that is already public.

If the counterpart is missing, say so and either add it or skip with a reason (desktop-only capability, landing-only SEO, etc.). Do not silently ship a public surface in one host.

## Switch

When the user is in one host, or says "also landing / also the app / switch":

1. Identify the surface (route, component, service).
2. Open the counterpart from the map below. Search names in the other package (`player-profile`, `replay-`, `leaderboard-`, `match-social`, `auth`).
3. Compare capabilities. Port behavior, not files.
4. Shared markup → extract or extend `packages/ui`. Host data/i18n/navigation stay in adapters.
5. Shared API → method on `@company-of-heroes/api` (and PocketBase hook if new server route), then both hosts consume it.
6. Changeset: list every host package that users will notice (`@company-of-heroes/app`, `@company-of-heroes/landing`, `@company-of-heroes/ui`, `@company-of-heroes/api`, `@company-of-heroes/pocketbase`).

Do not copy a component tree from app into landing (or the reverse).

## Counterpart map

| Surface | App | Landing |
|---|---|---|
| Player profile | `routes/(loaded)/players/[id]/` | `routes/players/[id=playerid]/` |
| Player search | `routes/(loaded)/players/` | `routes/players/` |
| Leaderboards | `routes/(loaded)/leaderboards/` | `routes/leaderboards/` |
| Replay list | `routes/(loaded)/history/` (local + catalog) | `routes/replays/` |
| Replay detail | `routes/(loaded)/replays/[replayId]/` | `routes/replays/[id]/` |
| Match comments/likes | `$lib/components/match/match-comments.svelte` + `app.database.matchSocial` | `$lib/remote/match-social.remote.ts` via `locals.services.matchSocial()` |
| Auth | `$core/account`, account settings | `/login` `/register` `/logout`, `locals.services.auth()`, `/auth/handoff` |
| Shared API client | `$core/api` (`createApi` singleton) | `createServices` → `createApi` |
| Player UI adapter | `$lib/components/player/` | `$lib/components/player/` (thin wrappers around `@company-of-heroes/ui/player`) |
| Replay UI adapter | `$lib/components/replay/` | `$lib/components/replay/` |
| Shared primitives | `$lib/components/ui/*` re-exports `@company-of-heroes/ui` | import `@company-of-heroes/ui/*` directly |

App player UI is richer (label editor, screenshots, cheater alert, live game). Do not strip those when touching app. Do not invent Tauri-only widgets on landing.

## Implement per host

Same product, different wiring.

**App (`adapter-static`, `ssr = false`):**

- Data in the client: `+page.ts`, components, `$core`. No `+server.ts` / `+page.server.ts`.
- HTTP via `fetch` from `$core/http/fetch`. PocketBase client I/O via `$core/api` (`@company-of-heroes/api`).
- User copy through `t()`; add keys to `packages/i18n/locales/{en,es,ko}.json`.
- Native work in `src-tauri`, called with `invoke`.

**Landing (`adapter-cloudflare`):**

- Loads, actions, remotes call `locals.services.*()`, not inline `fetch` to `API_URL`.
- Services are thin wrappers over `createApi` and return `Result` / `ResultAsync` (`neverthrow`). Unwrap in loads/remotes; `failFrom` in form actions.
- User copy through `t()` / `locals.t`; dictionaries live in `packages/i18n`. English URLs stay unprefixed; `/es` and `/ko` prefixes for other locales. Per-request i18n — never a module singleton.
- Set cache headers and `<svelte:head>` on public pages.
- No `$core`, Tauri, or `$features`.

**Shared API (`packages/api`):**

- `createApi({ pocketbase, fetch, baseUrl, userId? })` — neverthrow + zod.
- No Svelte, Tauri, or host `$lib`. Hosts own PB lifecycle (cookie vs desktop auth store).

**Shared UI (`packages/ui`):**

- Presentational only. Props for data, map images, hrefs, labels.
- No `$lib`, `$core`, `$app`, `$features`, Tauri, PocketBase client, or i18n.
- New public file → `exports` in `packages/ui/package.json`.
- Hosts wrap with resolvers (`flagImageUrl`, `resolveAvatarUrl`, `href`) and `t()`.

```svelte
<!-- landing adapter — pass host resolvers, do not fork the shared component -->
<PlayerProfileHeader {player} {flagImageUrl} {resolveAvatarUrl} {smurfLenderHref} />
```

```typescript
// app data
await app.database.matchSocial.listComments(lobbyId);

// landing data
unwrapAsync(locals.services.matchSocial().listComments(lobbyId));
```

## Do not

- Copy `$core` / `Feature` / `invoke` into landing
- Put `t()` inside `packages/ui` (pass label props from hosts instead)
- Add `+page.server.ts` or remotes to the app
- Duplicate Button / Leaderboard / Replay / Player chrome in a host when `@company-of-heroes/ui` already exports it
- Finish a public player/replay/leaderboard/comment/auth change in one host without checking the other
- Put marketing layout into `packages/ui`

## After the change

- If both hosts changed, verify the counterpart still compiles and the shared component props still match.
- Privacy: public data or new account fields → `POLICY.md` (landing `/privacy` renders it).
- Changeset lists every affected package; do not add a second file for polish on unreleased work.
