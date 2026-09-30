---
name: app-vs-website
description: Decides whether a change belongs in packages/app (Tauri desktop), packages/website (coh1stats.com), both, or packages/ui. Maps counterpart routes and host adapters so the same product surface is not implemented in only one host by accident. Use when editing app or website UI, player profiles, leaderboards, replays, comments, auth/login, shared components, or when the user asks to switch hosts, do the same on the website, also in the desktop app, or whether something must be built in both.
---

# App vs website

Two SvelteKit hosts share `@company-of-heroes/ui`, `@company-of-heroes/api`, and public PocketBase APIs. They are not copies of each other. Before writing code, pick a host (or both) and find the counterpart.

## Decide first

Classify the work. Do not start in the package that happens to be open.

| Kind                                                                       | Where                                                                                                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop / Tauri / local game                                               | `packages/app` only                                                                                                                   |
| Marketing / SEO / Cloudflare site chrome                                   | `packages/website` only                                                                                                               |
| Public product surface (players, leaderboards, replays, comments, account) | **both** hosts; the component in `packages/ui` (host context for I/O); client I/O in `packages/api`; public HTTP in website `/api/v1` |
| UI used by both                                                            | `packages/ui` only; hosts provide the host context once and pass host-only extras as snippets                                         |
| Shared PocketBase / API client logic                                       | `packages/api` (`createApi`); hosts inject PB + fetch                                                                                 |

**App-only:** live lobby writes from game, current game, history watchers, settings, shortcuts, Twitch, admin, splash/onboarding, Tauri commands, `$core`, `Feature` classes, screenshots/anti-cheat capture, local match list (`Match.ListTable`).

**Website-only:** home/download/fair-play marketing, `/privacy` (renders `POLICY.md`), `/card` OG images, `/login` `/register` `/logout` cookie auth, `+page.server.ts` / `+server.ts` / `$lib/remote/*.remote.ts`, neverthrow unwrap + rate-limited replay file proxy.

**Both (check the other host):** player profile, player search, leaderboards, replay list/detail, match comments/likes, website vs desktop login, player performance, labels/smurf UI that is already public.

If the counterpart is missing, say so and either add it or skip with a reason (desktop-only capability, website-only SEO, etc.). Do not silently ship a public surface in one host.

## Switch

When the user is in one host, or says "also website / also the app / switch":

1. Identify the surface (route, component, service).
2. Open the counterpart from the map below. Search names in the other package (`player-profile`, `replay-`, `leaderboard-`, `match-social`, `auth`).
3. Compare capabilities. Port behavior, not files.
4. Shared markup → move it into `packages/ui` (i18n via `useI18n()`, host differences via `useHost()` ports). Only data loading stays in the host page.
5. Shared API → method on `@company-of-heroes/api` (and PocketBase hook if new server route), then both hosts consume it.
6. Changeset: list every host package that users will notice (`@company-of-heroes/app`, `@company-of-heroes/website`, `@company-of-heroes/ui`, `@company-of-heroes/api`, `@company-of-heroes/pocketbase`).

Do not copy a component tree from app into website (or the reverse).

## Counterpart map

| Surface              | App                                                                        | Website                                                                   |
| -------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Player profile       | `routes/(loaded)/players/[id]/`                                            | `routes/players/[id=playerid]/`                                           |
| Player search        | `routes/(loaded)/players/`                                                 | `routes/players/`                                                         |
| Leaderboards         | `routes/(loaded)/leaderboards/`                                            | `routes/leaderboards/`                                                    |
| Replay list          | `routes/(loaded)/history/` (local + catalog)                               | `routes/replays/`                                                         |
| Replay detail        | `routes/(loaded)/replays/[replayId]/`                                      | `routes/replays/[id]/`                                                    |
| Match comments/likes | `$lib/components/match/match-comments.svelte` + `app.database.matchSocial` | `$lib/remote/match-social.remote.ts` via `locals.services.social`          |
| Auth                 | `$core/account`, account settings                                          | `/login` `/register` `/logout`, `locals.services.auth`, `/auth/handoff`   |
| Shared API client    | `$core/api` (`createApi` singleton)                                        | `new Services(locals)` (`locals.services`) + `createApi`                  |
| Host wiring          | `$lib/host.ts` (`provideAppHost`)                                          | `$lib/host.ts` (`provideWebsiteHost`)                                     |
| Player / replay UI   | `@company-of-heroes/ui/player`, `…/replay`, `…/comment` (no host copies)   | same                                                                      |
| Shared primitives    | `$lib/components/ui/*` re-exports `@company-of-heroes/ui`                  | import `@company-of-heroes/ui/*` directly                                 |

App player UI is richer (label editor, screenshots, cheater alert, live game). Do not strip those when touching app. Do not invent Tauri-only widgets on website.

## Implement per host

Same product, different wiring.

**App (`adapter-static`, `ssr = false`):**

- Data in the client: `+page.ts`, components, `$core`. No `+server.ts` / `+page.server.ts`.
- HTTP via `fetch` from `$core/http/fetch`. PocketBase client I/O via `$core/api` (`@company-of-heroes/api`).
- User copy through `t()`; add keys to `packages/i18n/locales/{en,es,ko}.json`.
- Native work in `src-tauri`, called with `invoke`.

**Website (`adapter-cloudflare`):**

- Loads, actions, remotes call `locals.services.x`, not inline `fetch` to `API_URL`.
- Services are thin wrappers over `createApi` and return `Result` / `ResultAsync` (`neverthrow`). Unwrap in loads/remotes; `failFrom` in form actions.
- User copy through `t()` / `locals.t`; dictionaries live in `packages/i18n`. English URLs stay unprefixed; `/es` and `/ko` prefixes for other locales. Per-request i18n — never a module singleton.
- Set cache headers and `<svelte:head>` on public pages.
- No `$core`, Tauri, or `$features`.

**Shared API (`packages/api`):**

- `createApi({ pocketbase, fetch, baseUrl, userId? })` — neverthrow + zod.
- No Svelte, Tauri, or host `$lib`. Hosts own PB lifecycle (cookie vs desktop auth store).

**Shared UI (`packages/ui`):**

- Every component exists once, here. Hosts do not wrap, copy or re-compose it.
- Text: call `useI18n()` from `@company-of-heroes/i18n` inside the component. No `*Label` props (only real overrides such as a context-specific `emptyMessage`).
- Host differences (links, images, auth, data I/O, toasts, navigation) go through the host context: `useHost()` from `@company-of-heroes/ui/host` (`packages/ui/src/host/host.context.ts`). Need something new? Add a port there and implement it in both hosts:
  - app: `packages/app/src/lib/host.ts` (`provideAppHost()` in `routes/(loaded)/+layout.svelte`)
  - website: `packages/website/src/lib/host.ts` (`provideWebsiteHost()` in the root `+layout.svelte`)
- Host-only extras (desktop label editor, screenshots, cheater flags, rename) are snippets on the shared component (`actions`, `screenshots`, `nameExtra`, `extraTabs`…), not a forked component.
- Still no `$lib`, `$core`, `$app`, `$features`, Tauri or PocketBase client imports.
- Pure helpers used by both hosts live in ui too (`format/*`, `replay/stats`, `replay/parse`, `replay/links`, `live-lobby/links`, `player/profile`); host modules re-export them instead of copying.
- New public file → `exports` in `packages/ui/package.json`.

```svelte
<!-- website page: data in, nothing else -->
<PlayerProfile {player} />

<!-- app page: same component, desktop-only extras as snippets -->
<PlayerProfile player={pagePlayer}>
	{#snippet actions()}<Player.LabelEditor … />{/snippet}
</PlayerProfile>
```

```typescript
// app data
await app.database.matchSocial.listComments(lobbyId);

// website data
unwrapAsync(locals.api.matchSocial.listComments(lobbyId));
```

## Do not

- Copy `$core` / `Feature` / `invoke` into website
- Add a component to `app/src/lib/components` or `website/src/lib/components` that also exists (or should exist) in the other host — put it in `packages/ui` and extend the host context (`pnpm check:duplicates` fails on same-named host components)
- Add `*Label` / resolver props to a shared component, or wrap a ui component in a host just to pass labels, hrefs or images
- Add `+page.server.ts` or remotes to the app
- Duplicate Button / Leaderboard / Replay / Player chrome in a host when `@company-of-heroes/ui` already exports it
- Finish a public player/replay/leaderboard/comment/auth change in one host without checking the other
- Put marketing layout into `packages/ui`

## After the change

- If both hosts changed, verify the counterpart still compiles and the shared component props still match.
- Privacy: public data or new account fields → `POLICY.md` (website `/privacy` renders it).
- Changeset lists every affected package; do not add a second file for polish on unreleased work.
