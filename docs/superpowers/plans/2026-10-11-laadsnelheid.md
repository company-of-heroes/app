# Laadsnelheid App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Data laden in de desktop-app merkbaar sneller maken door de bottlenecks uit het onderzoek van 2026-10-11 weg te nemen, verdeeld over parallelle agents met gescheiden bestanden.

**Architecture:** Vier golven. Golf 0 (coördinator) legt een baseline vast en levert twee gedeelde helpers. Golf 1 draait zes agents parallel per laag (transport, Rust, API-client, PocketBase, website-services, boot). Golf 2 draait twee UI-agents die op golf 1 bouwen. Golf 3 bevat structurele datamodel-wijzigingen die elk een eigen spec krijgen en niet in dit plan worden uitgevoerd.

**Tech Stack:** Svelte 5 runes + SvelteKit (adapter-static) in Tauri 2, Rust, PocketBase 0.2x (JSVM hooks + SQLite), `@company-of-heroes/api` (neverthrow + zod), website op Cloudflare.

**Spec:** De onderzoeksbevindingen in deze sessie (vier rapporten: API-client, PocketBase, routes/componenten, opstart/core). De bestandsverwijzingen per taak hieronder komen daaruit.

## Global Constraints

- **Geen tests.** Schrijf geen tests en breid ze niet uit (`.claude/rules/cursor/no-tests.md`). Een taak is af na `check`, `svelte-autofixer` en handmatige controle in de draaiende app.
- **Elke agent bewerkt alleen de bestanden onder "Files" van zijn eigen taken.** Heb je een bestand van een andere agent nodig, meld dat dan aan de coördinator en bewerk het niet zelf.
- **Agents committen niet.** Op `master` staat nog onafgemaakt werk. De coördinator controleert en de gebruiker commit.
- Elk bewerkt `.svelte`/`.svelte.ts`-bestand gaat door `mcp__svelte__svelte-autofixer` totdat die geen meldingen meer geeft.
- Volg blank-lines-, curly-brace- en Svelte-patronen uit `.claude/rules/cursor/*`. `setContext` alleen bij init.
- `migrate()` blijft schema-only. Geen `CREATE INDEX` op `lobbies` of `lobby_player_index` binnen `migrate()`. `DROP INDEX` mag wel.
- Nieuwe migraties: golf-1 agent D gebruikt `1791000043`–`1791000049`, agent E `1791000050`–`1791000059`.
- HTTP in de app gaat via `fetch` uit `$core/http/fetch`. PocketBase-toegang via `@company-of-heroes/api` of de bestaande facades.
- Gedrag dat de gebruiker ziet blijft gelijk, behalve waar een taak expliciet "gedragswijziging" zegt.
- Eén changeset aan het eind (coördinator): `.changeset/faster-loads.md`, `patch` voor `@company-of-heroes/app`, `@company-of-heroes/api`, `@company-of-heroes/ui`, `@company-of-heroes/website` en `@company-of-heroes/pocketbase`, met de regel `enhance; faster data loading across the app`.
- `POLICY.md` blijft ongewijzigd. Er wordt geen nieuwe data verzameld of gepubliceerd.

**Verificatiecommando's**
- App: `pnpm --filter @company-of-heroes/app check`
- UI: `pnpm --filter @company-of-heroes/ui check`
- Website: `pnpm --filter @company-of-heroes/website check`
- API: `pnpm --filter @company-of-heroes/app check` (de app typecheckt `packages/api` mee)
- Rust: `cargo check --manifest-path packages/app/src-tauri/Cargo.toml`
- Handmatig: `pnpm dev`, daarna de app openen en het Network-paneel van de devtools bekijken.

## Review Focus

1. **Website-calls via browser-fetch.** Requests met een `Authorization`-header, een non-2xx-antwoord, offline gaan en de lokale website op `localhost` moeten dezelfde foutafhandeling en meldingen geven als nu. Browser-fetch gooit `TypeError` waar plugin-http andere errors gaf. Getest in taak A1, stap 3.
2. **Verouderde data na een mutatie.** Na een like, label, hide of profielwijziging moet de volgende weergave de nieuwe data tonen en niet de gecachte. Getest in C5 en G2, stap "mutatie".
3. **Boot met verlopen of ongeldig token, of zonder netwerk.** De app moet nog steeds inloggen of offline starten en mag niet op het laadscherm blijven hangen. Getest in F1.
4. **Starten en afsluiten van het spel.** Live-lobby-detectie start binnen een paar seconden nadat CoH opstart, ook met een tragere poll. Getest in B1.
5. **Overlay na een app-update met een nieuwe `oppbot.zip`.** De overlay moet opnieuw geregistreerd worden en niet overgeslagen omdat er een cache is. Getest in B3.

---

## Golf 0 — Coördinator (vóór alle agents)

### Task 0: Baseline en gedeelde helpers

**Files:**
- Create: `packages/api/src/ttl-cache.ts`
- Create: `packages/api/src/concurrency.ts`
- Modify: `packages/api/src/index.ts` (exports)
- Create: `docs/superpowers/plans/2026-10-11-laadsnelheid-metingen.md`

**Interfaces:**
- Produces:
  - `createTtlCache<T>(options: { ttlMs: number; max?: number }): TtlCache<T>`
  - `interface TtlCache<T> { getOrLoad(key: string, load: () => T): T; peek(key: string): T | undefined; invalidate(key?: string): void }`. Alleen een resolved waarde blijft staan. Zit er een `PromiseLike` in die rejected of een neverthrow `Err` geeft, dan wordt de key verwijderd. `peek` geeft ook verlopen waarden terug (stale-while-revalidate). `max` staat standaard op 500 en het oudste item gaat er als eerste uit.
  - `mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]>`, met resultaten in dezelfde volgorde als de input.

- [ ] **Step 1:** Meet de baseline met `pnpm dev`, een ingelogde account, een koude start en het Network-paneel open. Noteer tijd-tot-content voor dashboard, eigen spelersprofiel, ander spelersprofiel, history, leaderboards (1v1 en 4v4), replays, streaming en toernooien. Noteer ook de boottijd (opstart tot dashboard) en het CPU-gebruik in Taakbeheer met CoH dicht. Alles gaat in het metingenbestand.
- [ ] **Step 2:** Implementeer `ttl-cache.ts` en `concurrency.ts` met de signatures hierboven en exporteer ze uit `packages/api/src/index.ts`.
- [ ] **Step 3:** Draai `pnpm --filter @company-of-heroes/app check`. Verwacht: 0 errors.

---

## Golf 1 — Zes agents parallel (na Task 0)

### Agent A — Transport en Relic (app core)

#### Task A1: Website-API via browser-fetch

**Files:**
- Modify: `packages/app/src/lib/core/http/fetch-routing.ts`
- Modify: `packages/app/src/lib/core/http/fetch.ts`

**Interfaces:**
- Produces: `shouldUseNativeFetch(url: string, pocketBaseOrigin: string, siteOrigin: string): boolean`. Geeft true voor PocketBase, localhost en de origin van `SITE_URL`.

- [ ] **Step 1:** Breid de routing uit. In `fetch.ts` haal je `siteOrigin` uit `SITE_URL` (`$core/site/urls`), en `configureCorsFetch` krijgt die origin in de `exclude`-lijst. Werk de doc-comment van `fetch()` bij.
- [ ] **Step 2:** Draai de app-check. Verwacht: 0 errors.
- [ ] **Step 3 (Review Focus 1):** Controleer handmatig:
  - Een spelersprofiel, de history en het zoeken laden.
  - In het Network-paneel zijn coh1stats.com-requests nu gewone XHR/fetch, geen `plugin:http`-IPC.
  - Een preflight `OPTIONS` geeft 204 (`packages/website/src/lib/hooks/handle.ts:39`).
  - Met netwerk uit geeft het profiel dezelfde foutmelding als vóór de wijziging.
  - Een request dat 401 of 404 geeft (een onbekende speler-id) wordt nog netjes afgehandeld.

  Wijken foutvormen af, pas dan de error-normalisatie in `sendV1`/`fetchJson` **niet** zelf aan, maar meld het aan agent C.

#### Task A2: Relic-client met cache en parallelle chunks

**Files:**
- Modify: `packages/app/src/lib/relic/index.ts`

**Interfaces:**
- Consumes: `createTtlCache`, `mapLimit` (Task 0)

- [ ] **Step 1:** Leid `request()` (`:409`) via een `createTtlCache` met `ttlMs: 60_000`. De key is method + URL + gesorteerde params. Dat geeft ook in-flight dedupe.
- [ ] **Step 2:** In `getProfileByIds` (`:115-147`) en `getPersonalStats` (`:153-173`) gaan de chunks van 10 met `mapLimit(chunks, 4, …)` in plaats van een sequentiële loop.
- [ ] **Step 3:** Draai de app-check. Controleer handmatig in het Network-paneel dat het dashboard `getProfileBySteamId` maar één keer opvraagt (eerder twee keer, hero `:171` en `:207`), en dat de rang-badges in de history nog kloppen.

#### Task A3: `exp()` goedkoper maken

**Files:**
- Modify: `packages/app/src/lib/core/pocketbase/index.ts:26-61`

- [ ] **Step 1:** Memoize de `camelCase`-conversie per key in een module-level `Map<string, string>`. De output-vorm verandert niet.
- [ ] **Step 2:** Draai de app-check. Controleer handmatig dat de history en een match-detail er hetzelfde uitzien.

### Agent B — Rust en Tauri

#### Task B1: Procescheck zonder volledige systeemsnapshot

**Files:**
- Modify: `packages/app/src-tauri/src/process_check.rs`
- Modify: `packages/app/src-tauri/src/lib.rs` (state registreren, indien nodig)
- Modify: `packages/app/src/lib/core/game/process.svelte.ts:43-45`

- [ ] **Step 1:** Houd één `sysinfo::System` vast in `tauri::State<Mutex<System>>`, aangemaakt met `System::new()`. Per call ververs je alleen de processen (`refresh_processes_specifics` met een lege `ProcessRefreshKind`). Draai het nog steeds in `spawn_blocking`.
- [ ] **Step 2:** Poll elke 3000 ms zolang het spel niet draait en elke 1000 ms zolang het wel draait.
- [ ] **Step 3:** Draai `cargo check`. Verwacht: OK.
- [ ] **Step 4 (Review Focus 4):** Controleer handmatig: start CoH, en binnen 3 s schakelt de app naar de game-running-status. Na afsluiten schakelt hij binnen 1 s terug. Het CPU-gebruik van de app in Taakbeheer met CoH dicht is lager dan de baseline.

#### Task B2: HTTP-compressie voor plugin-http

**Files:**
- Modify: `packages/app/src-tauri/Cargo.toml:29`

- [ ] **Step 1:** Kijk in de `Cargo.toml` van `tauri-plugin-http-2.4.4` in `~/.cargo/registry` welke compressie-features er zijn (verwacht `gzip`, `brotli`). Zet ze aan naast `dangerous-settings`. Is er geen feature, sla deze taak dan over en meld dat.
- [ ] **Step 2:** Draai `cargo check`. Controleer handmatig dat Relic-calls (een spelersprofiel) nog werken.

#### Task B3: Overlay-registratie alleen als de bundel veranderd is

**Files:**
- Modify: `packages/app/src/lib/core/app/features/overlays/overlay.svelte.ts` (`:227`, `:253-311`)
- Modify: `packages/app/src/lib/utils/unzip.ts:45`
- Modify: `packages/app/src-tauri/src/unzip.rs:200`
- Modify: `packages/app/src/routes/+layout.ts:21` (zip-import)

- [ ] **Step 1:** Laad `oppbot.zip` met `?url` in plaats van `?base64`, en fetch de bytes lazy, pas binnen `register()`.
- [ ] **Step 2:** Sla na een succesvolle register de SHA-256 van de bronzip plus de app-versie op in de overlay-settings. Bij de volgende boot sla je unzip, zip en hash over als beide gelijk zijn en de doelmap bestaat.
- [ ] **Step 3:** `zip_directory` geeft `tauri::ipc::Response` (raw bytes) terug in plaats van `Vec<u8>`/JSON, en de unzip-command neemt raw bytes aan (`tauri::ipc::Request` body) in plaats van `Array.from(bytes)`.
- [ ] **Step 4:** Draai `cargo check` en de app-check. Daarna `svelte-autofixer` op `overlay.svelte.ts`.
- [ ] **Step 5 (Review Focus 5):** Controleer handmatig: na een eerste boot staat de overlay klaar. Bij een tweede boot is er geen unzip-IPC meer in de logs. Verander één byte in de bronzip of bump de versie lokaal, en bij de volgende boot registreert hij opnieuw.

#### Task B4: Replay-mappen met één IPC lezen

**Files:**
- Create: command `list_replay_files(dir: String) -> Result<Vec<ReplayFileEntry>, String>` in `packages/app/src-tauri/src/replay_parser.rs`, met `ReplayFileEntry { name: String, path: String, modified_ms: u64, size: u64 }`, alleen `.rec`. Registreer de command in `lib.rs`.
- Modify: `packages/app/src/lib/core/app/features/replay-analyzer/analyzer.svelte.ts:136-167`
- Modify: `packages/app/src/lib/core/app/features/history/history.svelte.ts:586`, `:708-723`, `:765`
- Modify: `packages/app/src/routes/(loaded)/replays/replay-table.svelte:37-45`
- Modify: `packages/app/src-tauri/src/replay_parser.rs:207` (`parse_replay`: `fs::read` in `spawn_blocking`)

**Interfaces:**
- Produces: `listReplayFiles(dir: string): Promise<ReplayFileEntry[]>`, een TS-wrapper naast de bestaande Tauri-invokes in de analyzer-module, ook gebruikt door history en de replay-table.

- [ ] **Step 1:** Implementeer en registreer de Rust-command en de TS-wrapper.
- [ ] **Step 2:** Pas de drie plekken aan:
  - De analyzer gebruikt `listReplayFiles` in plaats van `join` + `stat` per bestand, en `ignoredFiles` wordt een `Set` voor de lookup.
  - `findPlaybackReplay` (`history.svelte.ts:708`) gebruikt `listReplayFiles`.
  - `replay-table` controleert alleen nieuwe rijen, tegen één `listReplayFiles`-resultaat per pagina in plaats van `exists` per rij.
- [ ] **Step 3:** Geef `history.svelte.ts:586` en `:765` een expliciete `fields`-lijst. `messages` staat er niet in voor lijsten. Gebruik alleen de velden die de UI leest (grep de consumers).
- [ ] **Step 4:** Draai `cargo check`, de app-check en `svelte-autofixer` op de bewerkte Svelte-bestanden.
- [ ] **Step 5:** Controleer handmatig:
  - De replays-pagina laadt en infinite scroll werkt.
  - De status "bestand ontbreekt" klopt nog als je een `.rec` verplaatst.
  - De analyzer pikt een nieuwe replay op.
  - `current-game-view` vindt de playback-replay.

### Agent C — API-client (`packages/api` + app database-facades)

#### Task C1: `skipTotal` waar het totaal niet gebruikt wordt

**Files:**
- Modify: `packages/api/src/matches/matches.ts` (`:189`, `:362`, `:378-381`)
- Modify: `packages/api/src/replays/replays.ts:917`
- Modify: `packages/api/src/notifications/notifications.ts` (`:57`, `:82`)
- Modify: `packages/api/src/companion/companion.ts:50`
- Modify: `packages/api/src/match-social/match-social.ts` (`:80`, `:141`, `:167`)
- Modify: `packages/api/src/live-lobbies/live-lobbies.ts` (`:219`, `:238`)
- Modify: `packages/api/src/auth/auth.ts:431`
- Modify: `packages/api/src/anti-cheat/anti-cheat.ts` (`:420`, `:473`, `:516`)

- [ ] **Step 1:** Grep per call site of `totalItems`/`totalPages` ergens gelezen wordt (in app, ui en website). Zo niet, voeg `skipTotal: true` toe. Gebruikt de paginering het totaal wel, laat het dan staan en noteer de plek in je rapport.
- [ ] **Step 2:** Draai de app-check en de website-check. Controleer handmatig dat de paginering op history en replays nog klopt.

#### Task C2: Gechunkte lookups parallel

**Files:**
- Modify: `packages/api/src/labels/labels.ts:147` (plus een `fields`-lijst voor de label-expand)
- Modify: `packages/api/src/player-social/player-social.ts:96`
- Modify: `packages/api/src/match-social/match-social.ts:492`
- Modify: `packages/api/src/live-lobbies/live-lobbies.ts:337`
- Modify: `packages/api/src/ratings/ratings.ts:537`

**Interfaces:**
- Consumes: `mapLimit` (Task 0), met limit 4

- [ ] **Step 1:** Vervang de sequentiële `for…await` over chunks door `mapLimit(chunks, 4, …)` en voeg de resultaten samen in de oorspronkelijke volgorde.
- [ ] **Step 2:** Draai de checks. Controleer handmatig dat labels en likes nog verschijnen op de leaderboards en in de history.

#### Task C3: Anti-cheat zonder N+1 en zonder wachtrij

**Files:**
- Modify: `packages/api/src/anti-cheat/anti-cheat.ts` (`:420-443`, `:586-660`, `:138`, `:201`)

- [ ] **Step 1:** Op `:420-443` gaan `users.getList` en `PlayersApi.search` samen in `Promise.all`.
- [ ] **Step 2:** Op `:586-660` vervang je de `getFirstListItem` per item door één `getFullList` met een OR-filter. Doe dat in chunks van 40 via `mapLimit` en koppel de resultaten via een `Map`.
- [ ] **Step 3:** Geef `:138` en `:201` een `fields`-lijst met alleen wat de admin-UI toont.
- [ ] **Step 4:** Draai de checks. Controleer handmatig dat de admin-tab "flagged" en het zoeken naar anti-cheat dezelfde rijen tonen.

#### Task C4: Timeouts in `sendV1`

**Files:**
- Modify: `packages/api/src/deps.ts` (`sendV1`)

- [ ] **Step 1:** Zonder `signal` van de caller gebruikt `sendV1` `AbortSignal.timeout(15_000)`. Is er wel een signal, combineer dan met `AbortSignal.any`. Laat `players.get` zijn eigen 45 s houden. Een timeout geeft dezelfde error-variant als een netwerkfout.
- [ ] **Step 2:** Neem meldingen van agent A1 over afwijkende foutvormen mee: normaliseer `TypeError` van browser-fetch naar de bestaande netwerkfout-variant.
- [ ] **Step 3:** Draai de checks.

#### Task C5: Spelers-endpoint dedupen en cachen

**Files:**
- Modify: `packages/api/src/players/players.ts` (`get`, rond `:145`)

**Interfaces:**
- Consumes: `createTtlCache` (Task 0)
- Produces: `PlayersApi.get(id, options?: { fresh?: boolean })`. De cache staat op `ttlMs: 60_000` en dedupet in-flight. `fresh: true` slaat de cache over en zet het nieuwe resultaat erin. `PlayersApi.invalidate(id?: string): void`.

- [ ] **Step 1:** Implementeer de cache in `get` en voeg `invalidate` toe. Laat dat bestaande `getPreview`-cachepad (`player-preview-cache.ts`) ongemoeid.
- [ ] **Step 2:** Roep `invalidate(id)` aan in de mutaties in `packages/api` die een spelersprofiel veranderen: labels, customization, smurf-watch, bans. Grep op schrijfacties die een player/steam id meekrijgen.
- [ ] **Step 3 (Review Focus 2):** Draai de checks. Controleer handmatig:
  - Op de toernooipagina gaat het aantal `/players/`-requests omlaag (één per unieke speler).
  - Als je een label aan een speler toevoegt, toont zijn profiel het label meteen.

#### Task C6: Dashboard- en replay-queries slanker

**Files:**
- Modify: `packages/api/src/matches/matches.ts:337-346` (`getList`)
- Modify: `packages/api/src/replays/replays.ts:917`

**Interfaces:**
- Produces: `matches.getList(filter, options?: { fields?: string; limit?: number })`. Zonder `limit` blijft het gedrag zoals nu. Met `limit` is het een `getList(1, limit, { skipTotal: true })`. Lijsten van `replays` laten standaard `messages` weg uit de `fields`.

- [ ] **Step 1:** Implementeer dit. Agent G1 gebruikt `fields`/`limit` voor de dashboard-hero.
- [ ] **Step 2:** Draai de checks.

#### Task C7: Gevaarlijke `getFullList`-calls in de app-facades

**Files:**
- Modify: `packages/app/src/lib/core/app/database/matches.ts:110` (`getAll` verwijderen als er geen callers zijn)
- Modify: `packages/app/src/lib/core/app/database/replays.ts` (`:63` `getAll`, `:189`)
- Modify: `packages/api/src/notifications/notifications.ts:70`

- [ ] **Step 1:** Grep naar callers.
  - Heeft `getAll` geen callers, verwijder het.
  - Op `replays.ts:189` vervang je `getFullList(20000)` door `getFirstListItem` met een filter op de filename en een `fields`-lijst.
  - Heeft `replays.getAll` callers, geef die dan `fields`.
  - In de notifications komt er een limiet op het aantal reads van de laatste 200.
- [ ] **Step 2:** Draai de checks. Controleer handmatig dat de notificaties en de replays-pagina werken.

### Agent D — PocketBase (indexes)

#### Task D1: Nutteloze `players`-indexes en dubbele lobby-indexes droppen

**Files:**
- Create: `packages/pocketbase/pb_migrations/1791000043_drop_unused_indexes.js`

- [ ] **Step 1:** Draai op een **kopie** van `pb_data/data.db` voor elk kandidaat-index `EXPLAIN QUERY PLAN` op de queries die de kolom raken. Grep daarvoor `packages/api/src`, `packages/website/src/lib/server` en `packages/jobs-worker/src`. Kandidaten:
  - `idx_lobbies_players_agg`
  - `idx_lobbies_user_players_agg`
  - `idx_replays_players_agg`
  - `idx_replays_createdBy_players_agg`
  - `idx_lobbies_map_agg`
  - `idx_lobbies_like_count`
  - `idx_lobbies_download_count`
  - `idx_lobbies_comment_count`
  - `idx_8b5JbSpePY`

  Drop alleen indexes die in geen enkel plan voorkomen of die een ander index volledig dekt. Noteer per index de reden in een comment in de migratie.
- [ ] **Step 2:** De migratie haalt de gekozen indexes uit `collection.indexes` en slaat de collection op. De down-migratie zet ze terug.
- [ ] **Step 3:** Draai `pnpm pb:up` op een kopie van de DB. Verwacht: `Server started` binnen een paar seconden. Draai de app tegen deze PocketBase en controleer handmatig dat dashboard, history, replays en leaderboards laden.

#### Task D2: Index voor de replay-lijst

**Files:**
- Create: `packages/pocketbase/pb_migrations/1791000044_replays_created_by_date.js`

- [ ] **Step 1:** Voeg `CREATE INDEX idx_replays_createdBy_gameDate ON replays (createdBy, gameDate)` toe via `collection.indexes`. Dit mag in `migrate()`: `replays` heeft ~23k rijen en staat niet op de verboden lijst. Voeg daarna `ANALYZE replays` toe.
- [ ] **Step 2:** Controleer met `EXPLAIN QUERY PLAN` op de kopie dat `createdBy = ? ORDER BY gameDate DESC` het index gebruikt en geen `SCAN replays` meer doet. Meet de replays-pagina handmatig tegen de baseline.

#### Task D3: Uitgestelde index-creatie voor grote tabellen

**Files:**
- Create: `packages/pocketbase/pb_hooks/deferred-indexes.pb.js`
- Create: `packages/pocketbase/pb_hooks/lib/deferred-indexes.js`

**Interfaces:**
- Produces: `DEFERRED_INDEXES: Array<{ collection: string; name: string; sql: string }>` in de lib. Agent E en golf 3 voegen daar entries aan toe. Een cron (`'*/2 * * * *'`, geregistreerd in `$app.onServe()` na `e.next()`) pakt per run één ontbrekend index op. Hij zet het in `collection.indexes`, slaat de collection op en draait `ANALYZE`. Staan alle indexes er al, dan doet de cron niets.

- [ ] **Step 1:** Implementeer dit met een lege lijst plus de entry van agent E (zie E1). Log de start en het einde per index met de duur.
- [ ] **Step 2:** Draai `pnpm pb:up` op de DB-kopie. Verwacht: `Server started` meteen, en daarna binnen 2 minuten een logregel dat het index klaar is.

### Agent E — Website-services en jobs

#### Task E1: `userGamesFilter` in twee stappen

**Files:**
- Modify: `packages/website/src/lib/server/services/match-history.ts` (`:433-441`, `:510`, `:593`)
- Modify: `packages/pocketbase/pb_hooks/lib/deferred-indexes.js` (alleen een entry toevoegen, na D3)

- [ ] **Step 1:** Haal eerst de lobby-ids op via `lobby_player_index` met `steam_id = S`, plus de lobbies met `lobby_user = X`. Beide kolommen zijn geïndexeerd; vraag alleen `fields: 'lobby'` op. Filter daarna op `id IN (...)`, in chunks van 200 met `mapLimit`. Gebruik dat in `userPlayers` en `distinctPlayers`, zodat het per request maar één keer gebeurt.
- [ ] **Step 2:** Mist er een index voor stap 1 (controleer met `EXPLAIN` op de kopie), voeg het dan toe aan `DEFERRED_INDEXES`.
- [ ] **Step 3:** Draai de website-check. Vergelijk handmatig de history-pagina's "eigen games" en "spelers" met de oude versie: zelfde aantallen en zelfde eerste pagina.

#### Task E2: Snellere spelerszoektocht (gedragswijziging, eerst bevestigen)

**Files:**
- Create: `packages/pocketbase/pb_migrations/1791000050_player_ratings_alias_lower.js`
- Create: `packages/pocketbase/pb_hooks/lib/alias-lower-backfill.js` (+ cron-registratie in `deferred-indexes.pb.js` of een eigen `.pb.js`)
- Modify: `packages/website/src/lib/server/services/players.ts:151-152`
- Modify: de schrijver van `player_ratings` (grep in `packages/website/src/lib/server` en `packages/jobs-worker/src`), voor de dual-write van `alias_lower`

- [ ] **Step 1:** **Vraag de coördinator om bevestiging van de gebruiker** voordat je begint. Zoeken wordt "begint met" met fallback naar "bevat" als er minder dan `limit` resultaten zijn en de query minstens 3 tekens heeft.
- [ ] **Step 2:** Voeg het veld `alias_lower` en `CREATE INDEX idx_player_ratings_alias_lower ON player_ratings (alias_lower)` toe. Bij 42k rijen mag dat in `migrate()`. Zet de dual-write op bij elke schrijfactie. Draai een backfill-cron in batches van 500 (`alias_lower = ''`), elke 3 minuten, op een ander moment dan de crons van D3.
- [ ] **Step 3:** De zoekservice draait een prefix-query (`alias_lower >= q && alias_lower < q + '￿'`, gesorteerd op `alias_lower`), plus de fallback uit step 1.
- [ ] **Step 4:** Draai de website-check. Controleer handmatig dat zoeken op een bekende naam en op een stuk midden in een naam allebei resultaten geeft.

#### Task E3: Cron-contentie verminderen

**Files:**
- Modify: `packages/jobs-worker/src/index.ts:7-23`

- [ ] **Step 1:**
  - Laat `replay-stats` niet in dezelfde minuut draaien als `result-fill`: oneven minuten tegenover elke minuut wordt even en oneven.
  - Verschuif `statistics-snapshot` naar minuut 5 binnen het 10-minutenvenster.
  - Beperk de 36 parallelle view-scans met `mapLimit(…, 4)`.
- [ ] **Step 2:** Draai `pnpm --filter @company-of-heroes/jobs-worker check` (of `tsc --noEmit` als er geen check-script is).

### Agent F — Boot en achtergrond (app core)

#### Task F1: Snellere boot

**Files:**
- Modify: `packages/app/src/lib/core/runtime/boot.svelte.ts:290-327`
- Modify: `packages/app/src/lib/core/account/account.svelte.ts:177`
- Modify: `packages/app/src/lib/core/app/features/feature.svelte.ts:82-120` (alleen als dat nodig is voor parallel registreren)

- [ ] **Step 1:** `ensureAccount` hergebruikt het opgeslagen token.
  - Is de JWT nog geldig voor meer dan 5 minuten: niets doen.
  - Is hij bijna verlopen: `authRefresh()`.
  - Alleen als dat faalt: `authWithPassword`.
- [ ] **Step 2:** Breng in kaart welke features in hun `enable()` state van een andere feature lezen. Registreer de rest met `Promise.allSettled` en houd de afhankelijke features sequentieel. Toon de UI zodra account en settings klaar zijn; features en `game.start()` lopen daarna op de achtergrond. Een feature-fout blokkeert de boot niet meer en wordt gelogd.
- [ ] **Step 3:** Draai de app-check en `svelte-autofixer` op de bewerkte `.svelte.ts`-bestanden.
- [ ] **Step 4 (Review Focus 3):** Controleer handmatig:
  - Een koude start, gemeten tegen de baseline.
  - Een start met een gemanipuleerd of verlopen token in de settings: de app logt in via het wachtwoord.
  - Een start zonder netwerk: de app komt in de offline-staat zoals nu, zonder te blijven hangen.

#### Task F2: Log-tailer

**Files:**
- Modify: `packages/app/src/lib/core/game/log/index.svelte.ts:47`
- Modify: `packages/app/src/lib/core/game/log/session.ts:441-505`

- [ ] **Step 1:** Zet `intervalMs` op 250.
- [ ] **Step 2:** Tijdens de catch-up-read (vanaf offset 0 tot EOF) roep je `#enrichStartedLobby` niet aan. Na de catch-up verrijk je alleen de laatste lobby die nog actief is.
- [ ] **Step 3:** Draai de app-check. Controleer handmatig met CoH aan: een nieuwe lobby verschijnt binnen ongeveer 1 s, met namen en rangen. Een app-start terwijl CoH al draait doet geen Relic-calls voor oude lobbies (Network-paneel).

#### Task F3: Settings en file-cache

**Files:**
- Modify: `packages/app/src/lib/core/config/settings.svelte.ts:139-162`
- Modify: `packages/app/src/lib/core/utils/fs-json.ts:19-28` (pad volgens de rapportage, grep zo nodig)
- Modify: `packages/app/src/lib/core/app/cache/cache.svelte.ts:44-68`

- [ ] **Step 1:** Settings schrijven compacte JSON (geen tab-indent). Laat de deep-watch staan, maar debounce de write op 500 ms als dat nog niet zo is. Haal de dubbele snapshot per feature weg als `feature.svelte.ts:98-104` dezelfde slice opnieuw wegschrijft. Dat bestand is van F1, dus F1 en F3 zijn dezelfde agent.
- [ ] **Step 2:** De cache doet één `get` in plaats van `has` + `get`, met een in-memory `Map` als eerste laag. `set` werkt de Map synchroon bij en de plugin async.
- [ ] **Step 3:** Draai de app-check en `svelte-autofixer`. Controleer handmatig dat een setting wijzigen en de app herstarten de waarde bewaart, en dat de history-pagina na een herstart uit de cache laadt.

#### Task F4: Notificaties zonder volledige refetch

**Files:**
- Modify: `packages/app/src/lib/core/app/features/notifications/notifications.svelte.ts:158-170` (pad volgens de rapportage)

- [ ] **Step 1:** Pas realtime `create`/`delete`-events lokaal toe op de lijst (voeg toe, of filter eruit) in plaats van de lijst opnieuw op te halen.
- [ ] **Step 2:** Draai de checks. Controleer handmatig: een notificatie verschijnt en verdwijnt bij lezen of verwijderen.

---

## Golf 2 — Twee UI-agents parallel (na agent A en C)

### Agent G1 — Spelersprofiel, history en dashboard

#### Task G1a: Spelersprofiel progressief renderen

**Files:**
- Modify: `packages/app/src/routes/(loaded)/players/[id]/+page.svelte` (`:37-63`, `:160`, `:251-261`)
- Modify: `packages/app/src/lib/player/smurf.ts:25-36`

- [ ] **Step 1:** `ready` wacht alleen nog op profile en user. Header, customization, smurf, performance en history krijgen elk een eigen bestaande `Skeleton` (uit `@company-of-heroes/ui`).
- [ ] **Step 2:** Breek de waterval:
  - Is de id al een steamId, start `steamProfile`, `header` en `customization` dan meteen parallel met `relicProfile`.
  - In `loadSmurfAlert` gaan watch, Relic en Steam in `Promise.all` waar de data dat toelaat.
- [ ] **Step 3:** Draai de app-check en `svelte-autofixer`. Controleer handmatig, voor een eigen profiel, een vreemd profiel via een numerieke Relic-id en via een steamId:
  - De header staat er eerder dan de history (zie de baseline).
  - Er is geen layout-sprong buiten de skeleton-plekken.
  - Flush borders volgens `.claude/rules/cursor/flush-borders.md`.

#### Task G1b: Hidden-match-lijsten en history-view

**Files:**
- Modify: `packages/app/src/lib/player/match-history-view.svelte.ts:29-143`
- Modify: `packages/app/src/lib/components/match-history/match-history.svelte:42-49`
- Modify: `packages/app/src/lib/relic/index.ts:321`, alleen de `filterPublicMatchHistory`-call. A2 is dan klaar, dus geen conflict.
- Create: `packages/app/src/lib/player/hidden-matches-cache.ts`

**Interfaces:**
- Consumes: `createTtlCache` (Task 0)
- Produces: `loadHiddenMatchFilters(): Promise<{ sessionIds: Set<string>; keywords: string[] }>`, met een TTL van 5 min, plus `invalidateHiddenMatchFilters(): void`. Die laatste wordt aangeroepen vanuit de admin-tab hidden-matches (G2).

- [ ] **Step 1:** Implementeer de cache en gebruik hem op beide plekken. Filter maar één keer, in de view. Haal de dubbele filter in `relic/index.ts:321` weg.
- [ ] **Step 2:** Splits de `$derived` in `match-history-view` zodat sorteren en filteren alleen opnieuw draaien als de matches of filters veranderen. De verrijking met avatars, labels en likes gebeurt per rij in een aparte `$derived`, gekeyed op de match-id.
- [ ] **Step 3:** Toon voor niet-staff de matches zodra de matches binnen zijn. Komen de filters later, dan wordt alsnog gefilterd. Voor staff ziet de gebruiker geen verschil.
- [ ] **Step 4:** Draai de checks en `svelte-autofixer`. Controleer handmatig dat een verborgen match op een profiel verborgen blijft en dat de history er hetzelfde uitziet.

#### Task G1c: Dashboard-hero en history-resource

**Files:**
- Modify: `packages/app/src/lib/components/widgets/widget-dashboard-hero.svelte` (`:196`, `:245-307`, `:769-794`)
- Modify: `packages/app/src/lib/components/widgets/widget-match-history.svelte:25-33`
- Modify: `packages/app/src/lib/core/app/features/history/matches.svelte.ts:274-279`
- Modify: `packages/app/src/lib/components/widgets/current-game-view.svelte` (`:107-145`)
- Create: `packages/app/src/lib/components/widgets/today-lobbies.svelte.ts`

**Interfaces:**
- Consumes: `matches.getList(filter, { fields, limit })` (C6)
- Produces: `useTodayLobbies(): { readonly items: Lobby[]; readonly loading: boolean }`. Dit is een module-level gedeelde store met één realtime-subscription op `lobbies` en een refcount, zodat hij stopt bij 0 gebruikers.

- [ ] **Step 1:** Hero en `widget-match-history` gebruiken `useTodayLobbies`. De query gaat met `fields` (zonder `result`/`lobbyPlayers` als de UI ze niet leest; grep de consumers) en `limit: 200`.
- [ ] **Step 2:** Pas de resources in de hero aan:
  - `recentMatches` start pas als `panelExpanded` true is.
  - `trackedPerformance` krijgt geen `fresh: true` meer.
  - Throttle `statsGeneration` naar maximaal één bump per 5 s.
- [ ] **Step 3:** De history-resource in `matches.svelte.ts` gebruikt een string-key (`resultKey`) als dependency in plaats van het `query`-object.
- [ ] **Step 4:** In `current-game-view` keyt `playbackReplay` op een string (sessionId + spelers-ids). De smurf-checks gaan via `mapLimit(players, 4, loadSmurfAlert)`.
- [ ] **Step 5:** Draai de checks en `svelte-autofixer`. Controleer handmatig:
  - Het dashboard laadt. "Matches vandaag" klopt en werkt live bij als er een match bijkomt (realtime).
  - Het paneel uitklappen laadt de recente matches.
  - In het Network-paneel draait er maar één `lobbies`-subscription.

### Agent G2 — Overige pagina's, admin en shared UI

#### Task G2a: Stale-while-revalidate voor leaderboards, toernooien en streams

**Files:**
- Modify: `packages/app/src/routes/(loaded)/leaderboards/+page.svelte` (`:53-165`)
- Modify: `packages/ui/src/leaderboard/leaderboard-list.svelte` (`:72`, `:148`)
- Modify: `packages/app/src/lib/components/widgets/widget-tournaments.svelte:11`
- Modify: `packages/app/src/routes/(loaded)/tournaments/+page.svelte` (`:9`, `:59`)
- Modify: `packages/app/src/routes/(loaded)/tournaments/[slug]/+page.svelte:28`
- Modify: `packages/ui/src/tournament/tournament-stats.svelte:40`
- Modify: `packages/app/src/lib/core/app/features/twitch/live-streams.svelte.ts` (`:102-110`, `:204`)

**Interfaces:**
- Consumes: `createTtlCache` (Task 0, via `peek` voor de initiële waarde)

- [ ] **Step 1:** Leaderboards:
  - Gebruik per board-id een module-level `createTtlCache` (`ttlMs: 120_000`). Een tab-wissel toont de gecachte data meteen en ververst op de achtergrond. De volledige skeleton verschijnt alleen zonder cache.
  - `leaderboard-list` rendert eerst 100 rijen en laadt er per 100 bij via een sentinel met `IntersectionObserver`.
  - Ratings, Steam en labels/likes worden alleen opgehaald voor rijen die gerenderd zijn.
  - **Gedragswijziging:** rijen buiten de eerste 100 verschijnen pas bij scrollen.
- [ ] **Step 2:** Toernooien:
  - Het widget en de pagina delen één module-cache voor "actief" en "aankomend".
  - De tekst "Loading..." wordt een `Skeleton`.
  - `tournament-stats` keyt op `tournament.slug` in plaats van op het object.
- [ ] **Step 3:** Streams:
  - `LiveStreamsFeed.stop()` bewaart de laatste items op module-niveau, en een nieuwe feed start met die items.
  - De Helix-fallback haalt de game-ids parallel op.
- [ ] **Step 4:** Draai de app-check, de ui-check en `svelte-autofixer` op alle bewerkte bestanden. Draai daarna `pnpm check:duplicates`.
- [ ] **Step 5 (Review Focus 2, mutatie):** Controleer handmatig:
  - Wissel van leaderboard-tab: de cache toont meteen data.
  - Like een speler op het leaderboard: de like blijft na een tab-wissel.
  - Het dashboard en `/streaming` tonen direct streams bij terugkomst.
  - Flush borders kloppen onder de lijst.

#### Task G2b: Admin-tabs en overige N+1

**Files:**
- Modify: `packages/app/src/routes/(loaded)/admin/tabs/flagged-tab.svelte:102-110`
- Modify: `packages/app/src/routes/(loaded)/admin/tabs/hidden-matches-tab.svelte` (`:89`, `:120-121`)
- Modify: `packages/app/src/routes/(loaded)/admin/tabs/{denylist,labels,modules,notifications,reputation,rewards,users}-tab.svelte` (alleen skeletons en effect-keys)
- Modify: `packages/app/src/routes/(loaded)/replays/[replayId]/+page.svelte:23-42`
- Modify: `packages/app/src/lib/components/match/match-live-state.svelte.ts:18-41`
- Modify: `packages/ui/src/reward/reward-icons.svelte:58`
- Modify: `packages/ui/src/tournament/tournament-trophies.svelte:88`
- Modify: `packages/app/src/lib/components/player/player-label-editor.svelte:37-74` (pad volgens de rapportage)

**Interfaces:**
- Consumes: `invalidateHiddenMatchFilters()` (G1b). Relic `getProfileByIds` (al bestaand, gebatcht en gecachet door A2).

- [ ] **Step 1:**
  - `flagged-tab` haalt profielen op via één `getProfileByIds`-batch in plaats van één per steamId.
  - `hidden-matches-tab` zoekt maps op in chunks van 200 via `mapLimit`, zodat rijen na de 200 ook een map krijgen (dit lost ook een bug op), en roept `invalidateHiddenMatchFilters()` aan na een wijziging.
- [ ] **Step 2:** De admin-tabs laden in een `$effect` dat alleen afhangt van de boolean `isStaff` (via een `$derived`), en tonen een bestaande `Skeleton` tijdens het laden.
- [ ] **Step 3:**
  - `replays/[replayId]` start de shared en de private request parallel en neemt de eerste die slaagt.
  - `match-live-state` controleert alle pending matches in één `mapLimit(…, 4)`.
  - `reward-icons` en `tournament-trophies` krijgen een `{:pending}`-blok met een `Skeleton`.
  - `player-label-editor` hergebruikt de labels uit de header-cache (`loadPlayerLabels`) in plaats van ze opnieuw op te halen.
- [ ] **Step 4:** Draai de app-check, de ui-check en `svelte-autofixer`. Controleer handmatig elke admin-tab, een private en een gedeelde replay, en de reward-iconen op een profiel.

#### Task G2c: Afbeeldingen

**Files:**
- Modify: de gedeelde `Avatar`- en `MapImage`-componenten in `packages/ui/src` (grep op `<img`)

- [ ] **Step 1:** Zet `loading="lazy"` en `decoding="async"` op alle `<img>` in gedeelde lijstcomponenten: avatars, map-images, leaderboard en match-list. Avatars van PocketBase-bestanden vragen de `thumb` `100x100` op via de bestaande host-port voor bestands-URL's. Is er geen thumb-parameter in die port, voeg die dan toe in `host.context.ts` en in beide `host.ts`-implementaties (app en website).
- [ ] **Step 2:** Draai de checks voor app, ui en website. Controleer handmatig dat de leaderboards en de history-avatars scherp en zichtbaar zijn.

---

## Afronding — Coördinator

- [ ] **Step 1:** Draai `pnpm check` (alle packages plus duplicates) en `cargo check`. Verwacht: 0 errors.
- [ ] **Step 2:** Herhaal de meting uit Task 0 en zet de resultaten naast de baseline in het metingenbestand.
- [ ] **Step 3:** Schrijf de changeset (zie Global Constraints).
- [ ] **Step 4:** Laat een verse reviewer de hele diff reviewen (`/code-review high`), met de Review Focus hierboven als checklist.
- [ ] **Step 5:** Geef de gebruiker een overzicht: wat er sneller is (de getallen), wat bewust anders werkt (E2 en G2a) en welke punten zijn overgeslagen, met reden.

---

## Golf 3 — Structureel (niet in dit plan; elk een eigen spec)

Elk van deze punten verandert het datamodel van grote tabellen en vraagt backfills en dual-writes. Ze krijgen elk een eigen brainstorm-, spec- en planronde, na de metingen van golf 1 en 2.

1. **`lobbies.players`/`result`/`replayStats` naar een 1:1-collection `lobby_details`.** Dit is de grootste resterende winst voor reads en writes op `lobbies`, maar raakt elke lobby-query in de api, de website en de jobs-worker.
2. **`history_players` van een view naar een echte tabel**, bijgewerkt bij lobby-writes en met een `alias_lower`-index. Dit lost de 0,4 s per zoek-toetsaanslag op de community-history op.
3. **`lobby_created_at`/`is_hidden` denormaliseren naar `lobby_player_index`**, met indexes `(steam_id, counts, lobby_created_at)` en `(profile_id, counts, lobby_created_at)`. Dat geeft snelle "played"-lijsten en tellingen voor gebruikers. De backfill gaat via de cron uit D3.

## Openstaande punten voor de gebruiker

- De rule `pocketbase-backfill-cron.md` verwijst naar `pb_hooks/lib/job-state.js`. Dat bestand is verwijderd in `1791000015`. Pas de rule aan of zet het bestand terug.
- `1791000007_lobbies_hidden_index.js` maakt al synchroon een index op `lobbies`, wat tegen die rule ingaat. Dit plan laat dat zo.
