# packages/app — Full Logic Rewrite (Big Bang)

## Goal

Rewrite the complete logic layer of `packages/app` while keeping the UI (markup, styling, component look & feel) essentially unchanged. Eliminate the recurring bugs caused by the current architecture. Scope decided with user:

- **Approach:** big-bang rewrite (everything lands in one release), including the entire Twitch stack.
- **Mandatory setup:** blocking onboarding wizard that forces the user to set a valid `warnings.log` path and CoH installation folder before the app can be used.
- **Settings:** robust import/export + automatic external backups (outside app data / installation folder) so an app update with "delete all data" never loses the PocketBase user.
- **Chat:** the social Chat feature is removed entirely (Twitch chat and in-game chat detection stay).
- **Comments:** users can leave comments on matches on the match detail page (`/history/[id]`).
- **Tests:** Vitest unit tests for the new core logic.

## Non-goals

- No visual redesign. Components under `src/lib/components/**` keep their markup/styles; only data wiring changes.
- No Rust changes (`src-tauri/**`) except none expected; webserver, ws_server, shortcuts, process_check stay as-is.
- No PocketBase server/schema changes (collections `comments`, `lobby_comments` already exist). Flag: verify API rules allow authenticated create/read on these collections.
- `packages/overlays` untouched (it consumes the same socket topics — keep topic names/payloads identical: `game.lobby.joined|started|destroyed`, `twitch.chat`, etc.).

## Why (current pain points found in code)

1. `AppContext.start()` (src/lib/core/app/context/app.svelte.ts) mixes settings IO, socket, feature boot, log events, dev fixtures, audio side effects.
2. Settings are scattered over plugin-store keys (`settings`, `feature.*`); persistence happens in `watch()` callbacks → race-prone, no atomic writes, no schema versioning.
3. Backup of config only happens in `Updater.enable()` via `setTimeout(1s)` copy; restore logic lives inside `Auth.enable()`'s `.catch()` chain — account recovery is implicit and fragile.
4. Import/export juggles `rename()` backup/restore of the live store file and requires a manual app restart; import is not schema-validated; `Feature.validateSettings` uses `mergeWith(imported, defaults)` which mutates input and accepts garbage.
5. `Feature.register()` resolves its promise inside a `watch()` — if `enabled` never flips the promise hangs; per-feature `app.store.set` writes race with the global one.
6. Log parser re-reads the whole `warnings.log` every 500ms and breaks when the file is truncated (game restart): `newLength <= oldLength` silently skips forever.
7. `Twitch.enable()` recreates `ApiClient`/`ChatClient`/`EventSubWsListener` inside a `watch` without disposing previous instances → duplicate chat listeners after token changes.
8. `History.enable()` polls relic every 5s forever, even with nothing pending; interval is never cleared on disable.
9. Paths are only checked once at boot with a dismissible modal — app can run unconfigured (root cause of "app does nothing" reports).

---

## Target architecture

```
src/lib/core/
  runtime/
    app.svelte.ts          # Slim AppContext facade (keeps `app.` surface for UI compat)
    boot.ts                # Explicit boot pipeline with phases + gates
    status.svelte.ts       # Statuses (coh/webserver/socket) tracking
  config/
    schema.ts              # Zod schemas: appSettings, account, per-feature slices; SCHEMA_VERSION
    settings.svelte.ts     # SettingsService: single reactive tree, debounced atomic persist
    migrations.ts          # v1 (plugin-store app.json) -> v2 migrations
    backup.ts              # BackupService: external rotating backups + restore discovery
    import-export.ts       # Validated envelope import/export
    paths.ts               # PathsService + CoH path validation + auto-detection
  account/
    account.svelte.ts      # AccountService: ensureAccount() state machine (replaces features/auth)
    recovery.ts            # Recovery decision tree (local -> backup -> legacy backup -> new)
  game/
    process.svelte.ts      # Game running / window focus / ingame chat open (rewrite of game.svelte.ts)
    log/
      tailer.ts            # Byte-offset file tailer w/ truncation detection (Tauri fs)
      parser.ts            # PURE line -> trigger-event parser (regexes ported as-is)
      session.ts           # LobbySession state machine: idle->populating->ready->started->gameover->destroyed
      index.svelte.ts      # GameLogService: wires tailer+parser+session, emits domain events
    lobby.ts               # Lobby/Match model (port of lobby.svelte.ts, pure)
  data/                    # PocketBase repositories (rewrite of app/database)
    client.ts              # pocketbase instance + exp() helper (ported)
    matches.ts
    replays.ts
    comments.ts            # match comments: list/create/reply/like/dislike/subscribe
    lobbies-live.ts
    users.ts
  services/
    socket.svelte.ts       # rewrite w/ auto-reconnect + resubscribe
    steam.ts               # port of core/steam
    relic.ts               # port of lib/relic
    cache.ts               # port of app/cache
  features/
    feature.svelte.ts      # New Feature base class (zod slice, deterministic lifecycle)
    registry.ts            # Ordered registry, error-isolated startAll()
    updater/
    shortcuts/
    history/
    replay-analyzer/
    twitch/                # twitch core (auth/api/chat/eventsub lifecycle)
    twitch-tts/
    tts-personal-voices/
    twitch-bot/
    twitch-overlays/
```

**Compatibility facade:** `$core/app/context` keeps exporting `app` with the same surface used by ~150 UI files (`app.settings`, `app.features.X`, `app.database` → aliased to `data`, `app.toast`, `app.modal`, `app.paths`, `app.game`, `app.lobby`, `app.socket`, `app.isReady`). UI imports keep working; only behaviour underneath is new. This keeps the big bang shippable without touching every component.

### Boot pipeline (`runtime/boot.ts`)

Executed from the splashscreen route; each phase is awaited, errors surface on the splashscreen instead of a white screen:

1. **Init:** read app version, init PathsService.
2. **Settings:** `SettingsService.load()`:
   - `settings.json` exists → migrate-if-needed → validate (zod) → done.
   - missing → look for legacy `app.json`/`app.dev.json` (plugin-store) → migrate to v2 → persist.
   - still missing → look for external backup (`settings-latest.json`, then newest rotated, then legacy `Documents/com.fknoobscoh.app.backup`) → propose restore in onboarding (flag `restoreCandidate`).
3. **Onboarding gate:** if CoH paths invalid (see validation rules) or restore candidate pending → `goto('/setup')` and **wait** until wizard completes. The `(loaded)` layout also guards against deep-linking while unconfigured.
4. **Account:** `AccountService.ensureAccount()` (see below). Failure → blocking error screen with retry (no silent new-user creation).
5. **Services:** socket connect (non-blocking w/ reconnect), autostart sync, cache.
6. **Features:** `registry.startAll()` — each feature isolated try/catch; failures set `status: 'error'` + toast, never abort boot.
7. **Game:** start process watcher; start log tailer when game running & path valid.
8. **Ready:** `app.isReady = true`, `goto('/')`, post-boot backup (`BackupService.backupNow('boot')`).

Dev fixtures (RANKED_2V2 etc.) move to `src/lib/dev/dev-boot.ts`, only invoked in `dev`.

---

## Workstream 1 — Settings core (config/)

### File format v2 (single file)

Location: `appConfigDir()` → `%APPDATA%/com.fknoobscoh.app/settings.json` (`settings.dev.json` in dev). Written atomically: write `settings.json.tmp` → `rename`.

```jsonc
{
  "schemaVersion": 2,
  "updatedAt": "2026-06-11T12:00:00Z",
  "app": {
    "autostart": true,
    "isStreamer": false,
    "paths": { "warningsLog": "", "gameDir": "" }
  },
  "account": { "userId": "", "email": "", "password": "" },
  "features": {
    "updater": { "enabled": true, "didReadChangelog": false, "version": "" },
    "twitch": { "enabled": false, "accessToken": null, "clientId": "..." },
    "history": { "enabled": true },
    // ... one slice per feature, each with its own zod schema
  }
}
```

- `config/schema.ts`: zod schema per slice + `settingsSchema` root; `SCHEMA_VERSION = 2`. Unknown keys preserved (`.loose()` on feature slices) so downgrades don't destroy data.
- `SettingsService` (`settings.svelte.ts`):
  - `load()`, `get` reactive `$state` tree, `replace(newTree)` (validated swap used by import/restore), `persist()` debounced (500ms) + `flush()` on window close.
  - Every successful persist schedules a debounced external backup (30s) via BackupService.
- `migrations.ts`: `migrateV1(appJson)` maps plugin-store keys: `settings` → `app` (+ `companyOfHeroesConfigPath`→`paths.warningsLog`, `companyOfHeroesInstallationPath`→`paths.gameDir`), `feature.auth` → `account`, `feature.X` → `features.X`. Unit-tested with a captured real `app.json` fixture.

### BackupService (`config/backup.ts`) — survives "delete all data"

- Location: `Documents/FKnoobs CoH/backups/` (outside `%APPDATA%` and outside the installation dir → survives NSIS uninstall with "delete app data" checked, and survives reinstall).
- Files: `settings-latest.json` (always current) + rotated `settings-<appVersion>-<timestamp>.json`, keep last **10**.
- Triggers: after boot, debounced after every settings change, **before import**, **before update install** (updater calls `backupNow('pre-update')` before opening the installer), on account creation (immediately — credentials must never exist only locally).
- `findRestoreCandidates()`: returns ordered candidates (latest v2 backup → rotated → legacy v1 `Documents/com.fknoobscoh.app.backup`, auto-migrated). Used by boot phase 2 and the onboarding wizard.
- All writes atomic; corrupt candidates (zod-invalid) are skipped, never crash.

### Import / Export (`config/import-export.ts`)

- **Export:** save-dialog → writes envelope `{ kind: 'fknoobs-settings', schemaVersion, appVersion, exportedAt, payload }`; payload = full settings tree (or one feature slice for per-feature export from Twitch tabs).
- **Import:** open-dialog → parse → accept envelope, raw v2 tree, or legacy v1 `app.json` (auto-migrate) → zod validate → **only then**: `backupNow('pre-import')` → `SettingsService.replace()` → live reactivity, **no restart required** → re-run path validation (invalid → onboarding gate kicks in) → re-run `ensureAccount()` if account changed.
- Failure at any step = no state touched, clear toast with reason. No `rename()` juggling of the live file.

---

## Workstream 2 — Onboarding wizard (mandatory CoH paths)

New route: `src/routes/(onboarding)/setup/+page.svelte` (uses existing UI kit: `Form`, `FileSelection`, `Button`, `H` — same visual style, dark theme).

Steps:
1. **Restore (conditional):** if `findRestoreCandidates()` non-empty and current settings are fresh → "We found a backup of your configuration (account + settings)" → [Restore] (primary) / [Start fresh]. Restoring fills paths/account and may skip the remaining steps if valid.
2. **warnings.log:** auto-detect `Documents/My Games/Company of Heroes Relaunch/warnings.log` (pre-filled if found). Validation: file exists **and** filename is `warnings.log`.
3. **Installation folder:** auto-detect `C:/Program Files (x86)/Steam/steamapps/common/Company of Heroes Relaunch` (+ scan Steam `libraryfolders.vdf` for alternate library paths, best-effort). Validation: directory exists **and** contains `RelicCOH.exe`.
4. **Finish:** persist + immediate backup → boot continues.

Enforcement:
- Boot gate (phase 3) blocks until `pathsValid` derived state is true.
- `(loaded)/+layout.svelte` guard: while `!app.isConfigured` redirect to `/setup` (covers prerendered deep links).
- Paths re-validated on every boot and when edited in Settings page; Settings page shows inline valid/invalid state using the same validators (`config/paths.ts` exports `validateWarningsLog(path)`, `validateGameDir(path)`).
- If paths become invalid mid-session (log read ENOENT) → toast + statuses error; log tailer stops gracefully.

## Workstream 3 — Account & recovery (replaces features/auth)

`AccountService.ensureAccount()` explicit flow (no logic hidden in catch chains):

```
credentials in settings.account?
├─ yes → authWithPassword(email, password)
│        ├─ ok → update lastLogin/meta.version (fire & forget) → done
│        └─ 404/400 → try backup credentials (if different) → retry once
│                   └─ still failing → BLOCKING recovery dialog:
│                        [Restore from backup] / [Create new account] (explicit, never silent)
└─ no  → backup candidate with account? → handled in onboarding step 1
         else → generate {userId, email, password} → create user → authWithPassword
                → persist + IMMEDIATE external backup → done
```

- Steam enrichment (`attachSteamId`, avatar/name from Steam) becomes `AccountService.attachSteamId()` called from the `game.authenticated` domain event; idempotent, debounced, errors logged not swallowed.
- `app.features.auth` facade getter maps to AccountService (UI uses `app.features.auth.userId`, `.user`, `.avatarUrl` — keep those getters).
- PocketBase `authStore` persistence: keep PB auth token in memory only; re-auth on boot (current behaviour, deterministic).

## Workstream 4 — Game core (process, log, lobby)

- `game/process.svelte.ts`: port of `Game` class; same reactive surface (`isRunning`, `isWindowFocused`, `isIngame`, `isIngameChatOpen`, `profile`, `steamId`); intervals properly disposed; keeps listening to Rust events `game-chat-enter` / `game-chat-escape`.
- `game/log/tailer.ts`: 500ms poll using `plugin-fs` `open()`/`seek()`/`read()` from `lastOffset`; **truncation detection** (size < lastOffset → reset offset + emit `truncated` → session reset); partial-line buffer for incomplete writes; fallback to full `readTextFile` diffing if streaming API fails.
- `game/log/parser.ts`: pure `parseLine(line): TriggerEvent | null`; port the existing magic-regexp trigger table verbatim (it is proven); fully unit-testable without Tauri.
- `game/log/session.ts`: explicit state machine producing domain events `log.ready`, `game.authenticated`, `game.logout`, `lobby.joined`, `lobby.started`, `lobby.result`, `lobby.gameover`, `lobby.destroyed`. Handles "app opened mid-game" (emit `lobby.started` after ready if a session is active — current hack formalized). Session id, players, map, ranks collected exactly as today.
- `runtime/app.svelte.ts` consumers: notification sound on lobby start when window unfocused (port), socket publishes with **identical topics/payloads** for the overlays package, `lobbies-live` upsert, history save on destroyed.

## Workstream 5 — Data layer (PocketBase repositories)

Rewrite `app/database/*` → `core/data/*` with consistent conventions (all methods: typed params, `fetch` from plugin-http, `exp()` mapping, no silent catch-and-return-fake-object like `getMatchAggregation` does today):

- `matches.ts`: port of current Matches (paginated/history list/byId/bySessionId/create/update/exists/aggregations) + realtime `subscribe(id)` helper used by `/history/[id]`.
- `replays.ts`, `lobbies-live.ts`, `users.ts`: straight ports with cleanup.
- `comments.ts`: see Workstream 8.
- Delete `chat-rooms.ts`.
- `database.ts` → `data/index.ts` exposing `data = { matches, replays, comments, lobbiesLive, users }`; facade `app.database` keeps pointing at it.

## Workstream 6 — Feature framework + all features (incl. Twitch)

**New `Feature` base (`features/feature.svelte.ts`):**
- `abstract id: FeatureId`, `abstract schema: ZodType<Slice>`, `settings` = reactive slice from SettingsService (`settings.features[id]`), `status: 'disabled'|'starting'|'active'|'error'` reactive.
- Lifecycle: `async start(ctx)` / `async stop()`; base watches `settings.enabled` and transitions with guaranteed `stop()` before re-`start()` (fixes duplicate-client bugs). No promise-resolution-inside-watch.
- Per-feature import/export delegates to `config/import-export.ts` (slice envelope).

**Registry (`features/registry.ts`):** deterministic order `[updater, shortcuts, history, replay-analyzer, twitch, twitch-tts, tts-personal-voices, twitch-bot, twitch-overlays]`; `startAll()` error-isolated.

**Rewrites per feature:**
- **updater:** release check via GitHub API; changelog modal logic; `backupNow('pre-update')` before launching installer download; remove the `setTimeout` config copy (BackupService owns backups now). Keep the "do not uninstall / keep data" warning copy, but data loss is now recoverable anyway.
- **shortcuts:** port logic; ensure unregister-all on stop; suppression while `isIngameChatOpen` kept.
- **history:** event-driven save on `lobby.destroyed` (replay file attach, needsResult); result polling only runs while pending matches exist (start/stop on demand, backoff 10s→60s), cleared on stop. `downloadReplay`/`downloadExists` ported.
- **replay-analyzer:** port scan/parse(worker)/upload; progress state shape unchanged (toast component relies on it).
- **twitch:** single `connect(token)` / `disconnect()` path; on token change: full dispose (chat listener unbind, `chatClient.quit()`, `eventSub.stop()`) before reconnect; token validation; badges/emotes parse → `socket.publish('twitch.chat', parsed)` unchanged.
- **twitch-tts**, **tts-personal-voices**, **twitch-bot**, **twitch-overlays:** port onto new base; subscribe to twitch events via typed emitter; ensure all listeners are disposed in `stop()`.
- **auth feature is deleted** (replaced by AccountService; facade keeps `app.features.auth` alias).
- Update ambient `Features` interface in `src/app.d.ts` (remove `chat`, keep `auth` alias typing → AccountService).

## Workstream 7 — Chat removal

Delete:
- `src/routes/(loaded)/chat/` (route)
- `src/lib/components/chat/` (components)
- `src/lib/core/app/features/chat/` (feature)
- `src/lib/core/app/database/chat-rooms.ts` (+ its export in database)
- Nav link + `ChatIcon` import in `(loaded)/+layout.svelte`
- `app.register('chat', chat)` in `routes/+layout.ts`; `chat` entry in `Features` (`src/app.d.ts`)

Keep (NOT part of social chat): Twurple Twitch chat, `game-chat-enter/escape` in-game chat detection, Twitch **ChatOverlay** (`features/twitch-overlays/overlays/chat`) — verify it doesn't import from `$lib/components/chat`; if it does, inline what it needs. PocketBase chat collections stay server-side (out of scope); regenerate `pocketbase/types.ts` only if the server schema is cleaned later.

## Workstream 8 — Comments on matches

Backend exists (`comments`, `lobby_comments` collections). UI components exist but are unused (`$lib/components/comments`, `$lib/components/comment`).

- `data/comments.ts` (rewrite of current `database/comments.ts`):
  - `getForMatch(matchId, page, perPage)` (via `lobby_comments` expand chain — port),
  - `getReplies(commentId, page, perPage)`,
  - `create(matchId, text)`, `reply(parentId, text, mentions?)`,
  - `toggleLike(commentId)` / `toggleDislike(commentId)` (toggle semantics: `likes+`/`likes-` based on current membership; remove opposite reaction — improvement over current add-only),
  - `subscribeToMatch(matchId, cb)` realtime for new comments.
- Refactor `components/comments/context.svelte.ts` onto the new repo (drop `replayId` dead path, remove leftover `$inspect`), pagination ("Load more").
- `/history/[id]/+page.svelte`: add `<Comments.Root matchId={...}>` section under the players table: total count header, editor (existing tiptap-based editor components), list with replies + like/dislike. Requires authenticated account (always true post-boot).
- Validation: non-empty trimmed text, max length (e.g. 2000 chars), submit disabled while pending, optimistic insert with rollback on error.

## Workstream 9 — Vitest

- Dev deps: `vitest`, `happy-dom`. Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.
- `vitest.config.ts`: environment `happy-dom`; aliases mirroring svelte.config (`$core`, `$features`, `$workers`, `$lib`) + test-double aliases for `$app/environment`, `@tauri-apps/api/*`, `@tauri-apps/plugin-*` → `src/tests/mocks/` (in-memory fs mock with `exists/read/write/rename/open+seek+read`, dialog mock, http mock).
- Fixtures: `src/tests/fixtures/warnings/*.log` (ranked 1v1 full game, custom 4v4, aborted game, mid-game app start, truncated/restarted log), captured from a real `warnings.log`; `src/tests/fixtures/app.v1.json` (legacy store file).
- Suites (all pure/mocked, no Tauri runtime):
  1. `config/schema` + `migrations` (v1→v2 with real fixture; unknown keys preserved)
  2. `config/settings` (atomic write, debounce flush — fake timers; corrupt file → backup fallback)
  3. `config/backup` (rotation keeps 10, candidate ordering, corrupt candidate skipped, legacy format restore)
  4. `config/import-export` (envelope roundtrip, legacy import, invalid input → state untouched)
  5. `config/paths` (validators + auto-detect logic with mocked fs)
  6. `game/log/parser` (every trigger regex against fixture lines)
  7. `game/log/session` (full-game event sequences per fixture; truncation reset; mid-game start)
  8. `game/log/tailer` (offset tracking, truncation, partial lines) with in-memory fs
  9. `account/recovery` (decision tree: ok / retry-with-backup / dialog paths)
  10. `data/comments` + `data/client.exp()` (pocketbase mocked)

## Workstream 10 — Final wiring & cleanup

- `routes/+layout.ts`: registers features via registry; calls `boot()`; remove chat/auth registrations.
- Splashscreen page: drive boot phases, show phase label + error state (keeps pacman animation).
- Settings page: same layout; path fields get inline validation states; import/export buttons call new module; add read-only "Backups" info block (location + last backup time + "Backup now" button) — minor UI addition, consistent styling.
- Delete old modules after ports: `core/app/context/*` (replaced), `core/log-parser/*`, `core/app/database/*`, `core/app/features/*` (old base + auth + chat), `core/app/cache` (moved), `core/app/socket.svelte.ts` (moved), `core/paths` (moved).
- Bump version (minor), update changelog content used by updater modal.
- `svelte.config.js`: keep aliases; add `'$config/*'`, `'$data/*'` only if needed (prefer staying within `$core/*`).
- Full `pnpm check` (svelte-check) + `pnpm test` + manual QA pass.

---

## Execution order (one release, ~10 sequential chunks)

1. Test harness + mocks + fixtures (Workstream 9 scaffolding first — enables TDD for everything after)
2. config/: schema, settings, migrations, backup, import-export, paths (+ tests)
3. account/ + recovery (+ tests)
4. game/: tailer, parser, session, process (+ tests)
5. data/ repositories (+ comments repo tests)
6. runtime/: boot pipeline, app facade, status, socket service
7. features/: base + registry, then updater, shortcuts, history, replay-analyzer, twitch, twitch-tts, tts-personal-voices, twitch-bot, twitch-overlays
8. Onboarding wizard route + guards; splashscreen rewiring; settings page wiring
9. Chat removal + match comments UI on `/history/[id]`
10. Cleanup of old modules, `src/app.d.ts` Features update, svelte-check green, manual QA

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Big-bang regressions across ~300 files | Facade keeps UI contracts; parser/session/regression covered by fixture tests; QA checklist below |
| Existing users' data must survive | v1→v2 migration tested with real `app.json` fixture; legacy Documents backup format supported in recovery |
| Overlays package depends on socket payloads | Topic names + payload shapes frozen; verify against `packages/overlays` usages before merge |
| PocketBase rules may block comment writes | Verify `comments`/`lobby_comments` create/update rules early (chunk 5); adjust server if needed (separate task) |
| plugin-fs streaming (`open/seek/read`) quirks on Windows | Tailer has full-read fallback path; both covered by tests |
| Twitch reconnect/disposal edge cases | Single connect/disconnect path + `stop()` before `start()` enforced by base class |

## Manual QA checklist (release gate)

1. Fresh install → onboarding wizard (auto-detected paths) → account created → backup exists in `Documents/FKnoobs CoH/backups/`.
2. Delete `%APPDATA%/com.fknoobscoh.app` (simulates update with "delete all data") → start app → restore proposed → same `userId` as before.
3. Legacy upgrade: existing `app.json` from current release → boots with all settings + same user, no wizard (paths valid).
4. Invalid path (rename warnings.log) → app blocks into wizard with explanation; fix → continues.
5. Export settings → wipe → import → identical state without restart; import a garbage file → rejected, nothing changed.
6. Play a game: lobby detected → sound when unfocused → match saved with replay → result fills in (needsResult flow) → comment + reply + like on the match detail page; second client sees comment via realtime.
7. Chat absent from nav/routes; Twitch connect, TTS, bot, overlays (incl. Twitch chat overlay) all function; updater dialog + changelog OK.
8. `pnpm check` and `pnpm test` green; app close persists settings (flush) without corruption.
